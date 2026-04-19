const Jimp = require('jimp');
const fs = require('fs');

/**
 * Compare two images and return a match score (0-100)
 * Uses advanced multi-method facial comparison
 */
async function compareFaces(imagePath1, imagePath2) {
  try {
    // Read both images
    const img1 = await Jimp.read(imagePath1);
    const img2 = await Jimp.read(imagePath2);

    // Resize both images to same dimensions for comparison
    const targetSize = 256;
    img1.resize(targetSize, targetSize);
    img2.resize(targetSize, targetSize);

    // Get pixel data
    const pixels1 = img1.bitmap.data;
    const pixels2 = img2.bitmap.data;

    // Calculate multiple similarity metrics and combine
    const pixelScore = calculatePixelSimilarity(pixels1, pixels2, targetSize);
    const histogramScore = compareHistograms(pixels1, pixels2);
    const edgeScore = compareEdges(pixels1, pixels2, targetSize);
    const regionScore = compareRegions(pixels1, pixels2, targetSize);
    const structuralScore = calculateSSIM(pixels1, pixels2, targetSize);

    // Weighted average of all metrics
    const combinedScore = 
      (pixelScore * 0.25) +      // 25% direct pixel comparison
      (histogramScore * 0.20) +  // 20% histogram similarity
      (edgeScore * 0.20) +       // 20% edge/feature detection
      (regionScore * 0.20) +     // 20% region-based comparison
      (structuralScore * 0.15);  // 15% structural similarity

    return Math.round(Math.min(100, Math.max(0, combinedScore)));
  } catch (error) {
    console.error('Face matching error:', error);
    return 0;
  }
}

/**
 * Advanced pixel-level similarity with adaptive thresholding
 */
function calculatePixelSimilarity(pixels1, pixels2, size) {
  if (pixels1.length !== pixels2.length) {
    return 0;
  }

  let matchScore = 0;
  let totalScore = 0;

  for (let i = 0; i < pixels1.length; i += 4) {
    const r1 = pixels1[i], g1 = pixels1[i + 1], b1 = pixels1[i + 2];
    const r2 = pixels2[i], g2 = pixels2[i + 1], b2 = pixels2[i + 2];

    // Calculate Euclidean distance in color space
    const rDiff = Math.abs(r1 - r2);
    const gDiff = Math.abs(g1 - g2);
    const bDiff = Math.abs(b1 - b2);
    
    const colorDistance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    
    // Adaptive threshold based on intensity
    const avgIntensity = (r1 + g1 + b1 + r2 + g2 + b2) / 6;
    const adaptiveThreshold = 20 + (avgIntensity > 128 ? 15 : 0);
    
    // Convert distance to similarity (0-100)
    const pixelSimilarity = Math.max(0, 100 - (colorDistance / adaptiveThreshold) * 100);
    matchScore += pixelSimilarity;
    totalScore += 100;
  }

  return (matchScore / totalScore) * 100;
}

/**
 * Chi-squared histogram comparison
 */
function compareHistograms(pixels1, pixels2) {
  const hist1 = calculateHistogram(pixels1);
  const hist2 = calculateHistogram(pixels2);

  let chiSquared = 0;
  let totalBins = 0;

  for (let i = 0; i < hist1.length; i++) {
    const h1 = hist1[i];
    const h2 = hist2[i];
    const sum = h1 + h2;
    
    if (sum > 0) {
      const diff = h1 - h2;
      chiSquared += (diff * diff) / sum;
      totalBins++;
    }
  }

  // Normalize chi-squared to 0-100 scale
  // Lower chi-squared = better match
  const normalizedChi = chiSquared / Math.max(1, totalBins);
  return Math.max(0, 100 - (normalizedChi * 2));
}

/**
 * Edge detection and feature comparison
 */
function compareEdges(pixels1, pixels2, size) {
  const edges1 = detectEdges(pixels1, size);
  const edges2 = detectEdges(pixels2, size);

  let matches = 0;
  for (let i = 0; i < edges1.length; i++) {
    if (edges1[i] && edges2[i]) matches++;
  }

  // Weight edge matches heavily - important facial features
  return (matches / Math.max(1, edges1.filter(e => e).length)) * 100;
}

/**
 * Region-based comparison (divide face into regions)
 */
function compareRegions(pixels1, pixels2, size) {
  const regionSize = size / 3; // 3x3 grid
  let totalScore = 0;
  let regionCount = 0;

  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      const startY = Math.floor(ry * regionSize);
      const startX = Math.floor(rx * regionSize);
      const endY = Math.floor((ry + 1) * regionSize);
      const endX = Math.floor((rx + 1) * regionSize);

      let regionMatch = 0;
      let regionCompares = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * size + x) * 4;
          
          const r1 = pixels1[idx], g1 = pixels1[idx + 1], b1 = pixels1[idx + 2];
          const r2 = pixels2[idx], g2 = pixels2[idx + 1], b2 = pixels2[idx + 2];

          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          regionMatch += Math.max(0, 100 - (diff / 3));
          regionCompares++;
        }
      }

      if (regionCompares > 0) {
        totalScore += regionMatch / regionCompares;
        regionCount++;
      }
    }
  }

  return regionCount > 0 ? totalScore / regionCount : 0;
}

/**
 * Simplified SSIM (Structural Similarity Index Measure)
 */
function calculateSSIM(pixels1, pixels2, size) {
  const windowSize = 11;
  const k1 = 0.01, k2 = 0.03;
  
  let ssimScores = 0;
  let windowCount = 0;

  for (let y = 0; y < size - windowSize; y += 5) {
    for (let x = 0; x < size - windowSize; x += 5) {
      let mean1 = 0, mean2 = 0;
      let var1 = 0, var2 = 0, cov = 0;

      // Calculate local statistics
      for (let dy = 0; dy < windowSize; dy++) {
        for (let dx = 0; dx < windowSize; dx++) {
          const idx = ((y + dy) * size + (x + dx)) * 4;
          const gray1 = (pixels1[idx] + pixels1[idx + 1] + pixels1[idx + 2]) / 3;
          const gray2 = (pixels2[idx] + pixels2[idx + 1] + pixels2[idx + 2]) / 3;
          
          mean1 += gray1;
          mean2 += gray2;
        }
      }

      const windowPixels = windowSize * windowSize;
      mean1 /= windowPixels;
      mean2 /= windowPixels;

      // Calculate variance and covariance
      for (let dy = 0; dy < windowSize; dy++) {
        for (let dx = 0; dx < windowSize; dx++) {
          const idx = ((y + dy) * size + (x + dx)) * 4;
          const gray1 = (pixels1[idx] + pixels1[idx + 1] + pixels1[idx + 2]) / 3;
          const gray2 = (pixels2[idx] + pixels2[idx + 1] + pixels2[idx + 2]) / 3;
          
          var1 += Math.pow(gray1 - mean1, 2);
          var2 += Math.pow(gray2 - mean2, 2);
          cov += (gray1 - mean1) * (gray2 - mean2);
        }
      }

      var1 /= windowPixels;
      var2 /= windowPixels;
      cov /= windowPixels;

      // Calculate SSIM for this window
      const c1 = (k1 * 255) ** 2;
      const c2 = (k2 * 255) ** 2;
      
      const numerator = (2 * mean1 * mean2 + c1) * (2 * cov + c2);
      const denominator = (mean1 ** 2 + mean2 ** 2 + c1) * (var1 + var2 + c2);
      
      const ssim = denominator > 0 ? numerator / denominator : 0;
      ssimScores += (ssim + 1) / 2 * 100; // Convert to 0-100
      windowCount++;
    }
  }

  return windowCount > 0 ? ssimScores / windowCount : 0;
}

/**
 * Detect edges using Sobel operator
 */
function detectEdges(pixels, size) {
  const edges = Array(size * size).fill(false);
  const threshold = 50;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      // Sobel operator
      let gx = 0, gy = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * size + (x + dx)) * 4;
          const gray = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
          
          gx += gray * (dx); // Sobel X kernel
          gy += gray * (dy); // Sobel Y kernel
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * size + x] = magnitude > threshold;
    }
  }

  return edges;
}

/**
 * Extract detailed face features from image
 */
async function extractFaceFeatures(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    const pixels = image.bitmap.data;
    
    // Get comprehensive image statistics
    const brightness = calculateBrightness(pixels);
    const contrast = calculateContrast(pixels);
    const histogram = calculateHistogram(pixels);
    const edges = detectEdges(pixels, image.bitmap.width);
    
    // Calculate image quality metrics
    const sharpness = calculateSharpness(pixels, image.bitmap.width);
    const colorVariance = calculateColorVariance(pixels);
    const faceRegionScore = calculateFaceRegionScore(pixels, image.bitmap.width);

    return {
      brightness,
      contrast,
      histogram,
      sharpness,
      colorVariance,
      faceRegionScore,
      edgeCount: edges.filter(e => e).length,
      qualityScore: (brightness > 50 && brightness < 200 && contrast > 20) ? 100 : 70,
      path: imagePath
    };
  } catch (error) {
    console.error('Feature extraction error:', error);
    return null;
  }
}

/**
 * Calculate average brightness
 */
function calculateBrightness(pixelData) {
  let total = 0;
  for (let i = 0; i < pixelData.length; i += 4) {
    total += (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
  }
  return Math.round(total / (pixelData.length / 4));
}

/**
 * Calculate contrast using standard deviation
 */
function calculateContrast(pixelData) {
  const brightness = calculateBrightness(pixelData);
  let variance = 0;
  
  for (let i = 0; i < pixelData.length; i += 4) {
    const gray = (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
    variance += Math.pow(gray - brightness, 2);
  }
  
  return Math.sqrt(variance / (pixelData.length / 4));
}

/**
 * Calculate sharpness using Laplacian operator
 */
function calculateSharpness(pixelData, size) {
  let laplacianSum = 0;
  
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const center = ((y * size + x) * 4);
      const centerGray = pixelData[center] * 0.299 + pixelData[center + 1] * 0.587 + pixelData[center + 2] * 0.114;
      
      let laplacian = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const idx = (((y + dy) * size + (x + dx)) * 4);
          const gray = pixelData[idx] * 0.299 + pixelData[idx + 1] * 0.587 + pixelData[idx + 2] * 0.114;
          laplacian += Math.abs(centerGray - gray);
        }
      }
      
      laplacianSum += laplacian;
    }
  }
  
  return Math.min(100, (laplacianSum / (size * size)) * 0.5);
}

/**
 * Calculate color variance (useful for detecting faces)
 */
function calculateColorVariance(pixelData) {
  const rValues = [], gValues = [], bValues = [];
  
  for (let i = 0; i < pixelData.length; i += 4) {
    rValues.push(pixelData[i]);
    gValues.push(pixelData[i + 1]);
    bValues.push(pixelData[i + 2]);
  }
  
  const rVar = calculateVariance(rValues);
  const gVar = calculateVariance(gValues);
  const bVar = calculateVariance(bValues);
  
  return (rVar + gVar + bVar) / 3;
}

/**
 * Helper function to calculate variance
 */
function calculateVariance(values) {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate score for face-like regions (skin tone detection)
 */
function calculateFaceRegionScore(pixelData, size) {
  let facePixels = 0;
  
  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    
    // Detect skin-like colors (rough heuristic)
    const isSkinLike = (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 15
    );
    
    if (isSkinLike) facePixels++;
  }
  
  return (facePixels / (pixelData.length / 4)) * 100;
}

/**
 * Generate histogram of image
 */
function calculateHistogram(pixelData) {
  const histogram = Array(256).fill(0);
  
  for (let i = 0; i < pixelData.length; i += 4) {
    const gray = Math.round((pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3);
    histogram[gray]++;
  }
  
  return histogram;
}

module.exports = {
  compareFaces,
  calculatePixelSimilarity,
  compareHistograms,
  compareEdges,
  compareRegions,
  calculateSSIM,
  detectEdges,
  extractFaceFeatures,
  calculateBrightness,
  calculateContrast,
  calculateHistogram,
  calculateSharpness,
  calculateColorVariance,
  calculateFaceRegionScore,
  calculateVariance
};
