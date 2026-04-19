/**
 * VerificationPage – 4-step identity verification wizard
 *
 * Steps (alive):
 *  1 → Upload Aadhaar Card
 *  2 → Upload PAN Card + enter PAN number
 *  3 → Upload Passport-size Photo (selfie, via file or webcam)
 *  4 → Join live video call with scheme admin
 *
 * Steps (deceased):
 *  1 → Upload Death Certificate → Done (pending admin review)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api';

/* ── Constants ───────────────────────────────────────────────────────────── */
const STEP_LABELS_ALIVE = [
  { num: 1, icon: 'pi-id-card', title: 'Aadhaar Card',      sub: 'Upload your Aadhaar card' },
  { num: 2, icon: 'pi-credit-card', title: 'PAN Card',           sub: 'Upload PAN card & number' },
  { num: 3, icon: 'pi-camera', title: 'Your Photo',          sub: 'Passport-size / selfie' },
  { num: 4, icon: 'pi-video', title: 'Video Verification',  sub: 'Live call with admin' },
];

const STATUS_META = {
  pending:       { label: 'Pending Review',  color: '#f59e0b', bg: '#fffbeb', icon: 'pi-clock' },
  pending_video: { label: 'Video Call Next', color: '#3b82f6', bg: '#eff6ff', icon: 'pi-video' },
  approved:      { label: 'Verified',        color: '#22c55e', bg: '#f0fdf4', icon: 'pi-check-circle' },
  rejected:      { label: 'Rejected',        color: '#ef4444', bg: '#fef2f2', icon: 'pi-times-circle' },
  not_submitted: { label: 'Not Submitted',   color: '#6b7280', bg: '#f9fafb', icon: 'pi-file' },
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function VerificationPage({ user }) {
  /* existing verification loaded from server */
  const [existing,   setExisting]   = useState(null);
  const [loaded,     setLoaded]     = useState(false);

  /* wizard state */
  const [mode,       setMode]       = useState(null);   // 'alive' | 'deceased' | null
  const [step,       setStep]       = useState(1);      // 1-4
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState(null);

  /* form fields */
  const [aadhaarFile,  setAadhaarFile]  = useState(null);
  const [panFile,      setPanFile]      = useState(null);
  const [panNumber,    setPanNumber]    = useState('');
  const [selfieFile,   setSelfieFile]   = useState(null);
  const [deathFile,    setDeathFile]    = useState(null);

  /* preview URLs */
  const [aadhaarPrev,  setAadhaarPrev]  = useState(null);
  const [panPrev,      setPanPrev]      = useState(null);
  const [selfiePrev,   setSelfiePrev]   = useState(null);
  const [deathPrev,    setDeathPrev]    = useState(null);

  /* webcam */
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [camOn,    setCamOn]    = useState(false);
  const [captured, setCaptured] = useState(false);

  /* load existing record */
  useEffect(() => {
    if (!user?.user_id) return;
    api.get(`/verify/status/${user.user_id}`)
      .then(r => setExisting(r.data))
      .catch(() => setExisting({ status: 'not_submitted' }))
      .finally(() => setLoaded(true));
  }, [user]);

  /* cleanup webcam on unmount */
  useEffect(() => () => stopCam(), []);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };

  const makePreview = (file, setter) => {
    if (!file) return;
    setter(URL.createObjectURL(file));
  };

  /* ── Webcam helpers ────────────────────────────────────────────────────── */
  const startCam = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      setCaptured(false);
    } catch {
      setError('Camera access denied. Please upload a photo instead.');
    }
  };

  const captureSelfie = () => {
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = v.videoWidth  || 640;
    canvas.height = v.videoHeight || 480;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      setSelfieFile(file);
      setSelfiePrev(URL.createObjectURL(blob));
      setCaptured(true);
      stopCam();
    }, 'image/jpeg', 0.92);
  };

  /* ── Submit documents and proceed to video call ────────────────────────── */
  const submitAlive = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('user_id',     user.user_id);
      fd.append('pan_number',  panNumber.trim().toUpperCase());
      fd.append('aadhaar_doc', aadhaarFile);
      fd.append('pan_doc',     panFile);
      fd.append('selfie',      selfieFile);

      const r = await api.post('/verify/submit', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      setExisting(r.data);
      setStep(4);
    } catch (e) {
      setError(e.response?.data?.error || 'Submission failed. Please check your files and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeceased = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('user_id',    user.user_id);
      fd.append('death_cert', deathFile);
      const r = await api.post('/verify/death-certificate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      setExisting(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    try {
      const r = await api.get(`/verify/status/${user.user_id}`);
      setExisting(r.data);
      if (r.data && r.data.status && r.data.status !== 'not_submitted') {
        setResult(r.data);
      }
    } catch {}
  }, [user]);

  const openVideoCall = () => {
    const url = result?.video_room_url || existing?.video_room_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resetWizard = () => {
    setMode(null); setStep(1); setResult(null); setExisting(null);
    setAadhaarFile(null); setPanFile(null); setSelfieFile(null); setDeathFile(null);
    setAadhaarPrev(null); setPanPrev(null); setSelfiePrev(null); setDeathPrev(null);
    setPanNumber(''); setError(''); setCaptured(false); stopCam();
    // re-fetch
    api.get(`/verify/status/${user.user_id}`)
      .then(r => { setExisting(r.data); setLoaded(true); })
      .catch(() => { setExisting({ status: 'not_submitted' }); setLoaded(true); });
  };

  /* ── Loading guard ──────────────────────────────────────────────────────── */
  if (!loaded) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
      Checking verification status…
    </div>
  );

  /* ── Already has a verified/pending record & mode not chosen ────────────── */
  if (existing && existing.status && existing.status !== 'not_submitted' && !mode) {
    const sm = STATUS_META[existing.status] || STATUS_META.not_submitted;
    return (
      <Wrapper>
        <PageHeader title="Identity Verification" sub="Your current verification status" />
        <div style={whiteCard({ textAlign: 'center' })}>
          <div style={{ marginBottom: 16 }}><i className={`pi ${sm.icon}`} style={{ fontSize: 52, color: sm.color }} /></div>
          <div style={{
            display: 'inline-block', padding: '6px 22px', borderRadius: 99,
            background: sm.bg, color: sm.color, fontWeight: 800, fontSize: 15, marginBottom: 16,
          }}>{sm.label}</div>
          <h2 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            {existing.status === 'approved'      && 'Your identity is verified!'}
            {existing.status === 'pending_video' && 'Documents received — video call required'}
            {existing.status === 'pending'       && 'Under admin review'}
            {existing.status === 'rejected'      && 'Verification not passed'}
          </h2>
          <p style={{ color: '#64748b', maxWidth: 420, margin: '0 auto 24px', fontSize: 14 }}>
            {existing.status === 'approved'      && 'You have full access to apply for government welfare schemes.'}
            {existing.status === 'pending_video' && 'Please join the live video call with the scheme admin to complete your verification.'}
            {existing.status === 'pending'       && 'An admin will review your uploaded documents shortly.'}
            {existing.status === 'rejected'      && `Reason: ${existing.admin_remarks || 'Please resubmit with clearer documents.'}`}
          </p>

          {existing.status === 'pending_video' && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Btn onClick={openVideoCall} color="#1d4ed8" big><i className="pi pi-video" style={{ marginRight: 6 }} />Verify by Video Call</Btn>
            </div>
          )}
          {existing.status === 'rejected' && (
            <Btn onClick={resetWizard} big>Resubmit Documents →</Btn>
          )}

          {existing.match_score != null && (
            <ScoreBar score={existing.match_score} style={{ marginTop: 24 }} />
          )}
          {existing.admin_remarks && existing.status !== 'rejected' && (
            <div style={{ marginTop: 16, padding: '12px 18px', background: '#fef9c3',
              borderRadius: 10, border: '1px solid #fef08a', fontSize: 13, color: '#713f12' }}>
              <strong>Admin note:</strong> {existing.admin_remarks}
            </div>
          )}
          {existing.status !== 'approved' && (
            <button onClick={refreshStatus} style={refreshBtnSt}><i className="pi pi-refresh" style={{ marginRight: 4 }} /> Refresh status</button>
          )}
        </div>
      </Wrapper>
    );
  }

  /* ── Mode selection ─────────────────────────────────────────────────────── */
  if (!mode) {
    return (
      <Wrapper>
        <PageHeader
          title="Identity Verification"
          sub="Choose the type of verification to proceed"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ModeCard
            icon="pi-user"
            title="I am a Living Beneficiary"
            desc="Verify your identity with Aadhaar card, PAN card, a photo, and a live video call with the scheme admin."
            steps={[
              'Upload Aadhaar Card',
              'Upload PAN Card',
              'Upload Your Photo',
              'Video Call with Admin',
            ]}
            color="#3b82f6"
            onClick={() => { setMode('alive'); setStep(1); setError(''); }}
          />
          <ModeCard
            icon="pi-file"
            title="Reporting a Deceased Beneficiary"
            desc="Upload a government-issued death certificate. An admin will review and close the account."
            steps={['Upload Death Certificate', 'Admin Review']}
            color="#64748b"
            onClick={() => { setMode('deceased'); setError(''); }}
          />
        </div>
      </Wrapper>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  /* DECEASED flow                                                          */
  /* ══════════════════════════════════════════════════════════════════════ */
  if (mode === 'deceased') {
    if (result) {
      return (
        <Wrapper>
          <PageHeader title="Death Certificate Submitted" />
          <div style={whiteCard({ textAlign: 'center' })}>
            <div style={{ marginBottom: 12 }}><i className="pi pi-file" style={{ fontSize: 48, color: '#64748b' }} /></div>
            <h2 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Certificate Uploaded</h2>
            <p style={{ color: '#64748b', maxWidth: 380, margin: '0 auto' }}>
              The death certificate has been submitted. An admin will review and update the account status.
            </p>
          </div>
        </Wrapper>
      );
    }
    return (
      <Wrapper>
        <PageHeader
          title="Upload Death Certificate"
          sub="Upload the official government-issued death certificate."
          onBack={() => { setMode(null); setError(''); }}
        />
        <div style={whiteCard()}>
          {error && <ErrorBox msg={error} />}
          <UploadArea
            label="Death Certificate"
            icon="pi-file"
            accept=".jpg,.jpeg,.png,.pdf"
            file={deathFile}
            preview={deathPrev}
            onChange={f => { setDeathFile(f); makePreview(f, setDeathPrev); }}
            large
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28,
            paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
            <GhostBtn onClick={() => { setMode(null); setError(''); }}>← Back</GhostBtn>
            <Btn onClick={submitDeceased} disabled={!deathFile || submitting} loading={submitting}>
              Submit Certificate →
            </Btn>
          </div>
        </div>
      </Wrapper>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  /* ALIVE flow — 4-step wizard                                             */
  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <Wrapper>
      <PageHeader
        title="Identity Verification"
        sub={`Step ${step} of 4 — ${STEP_LABELS_ALIVE[step - 1].title}`}
        onBack={step === 1
          ? () => { setMode(null); setError(''); stopCam(); }
          : () => { setStep(s => s - 1); setError(''); stopCam(); }}
      />

      {/* ── Stepper ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        {STEP_LABELS_ALIVE.map((s, i) => {
          const done   = step > s.num;
          const active = step === s.num;
          return (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 90 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: done ? '#22c55e' : active ? '#3b82f6' : '#e2e8f0',
                  color: (done || active) ? '#fff' : '#94a3b8',
                  boxShadow: active ? '0 0 0 4px rgba(59,130,246,0.2)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {done ? <i className="pi pi-check" /> : <i className={`pi ${s.icon}`} />}
                </div>
                <span style={{
                  fontSize: 11, textAlign: 'center',
                  color: active ? '#0f172a' : done ? '#22c55e' : '#94a3b8',
                  fontWeight: active ? 700 : 500,
                }}>{s.title}</span>
              </div>
              {i < STEP_LABELS_ALIVE.length - 1 && (
                <div style={{ width: 40, height: 2, background: done ? '#22c55e' : '#e2e8f0',
                  marginBottom: 22, transition: 'all 0.3s' }} />
              )}
            </div>
          );
        })}
      </div>

      {error && <ErrorBox msg={error} style={{ marginBottom: 16 }} />}

      {/* ── STEP 1: Aadhaar Card ──────────────────────────────────────── */}
      {step === 1 && (
        <div style={whiteCard()}>
          <StepHeading icon="pi-id-card" title="Upload Aadhaar Card" desc="Upload a clear image of your Aadhaar card. JPG, PNG, or PDF (max 10 MB)." />
          <UploadArea
            label="Aadhaar Card"
            icon="pi-id-card"
            accept=".jpg,.jpeg,.png,.pdf"
            file={aadhaarFile}
            preview={aadhaarPrev}
            onChange={f => { setAadhaarFile(f); makePreview(f, setAadhaarPrev); }}
            large
          />
          <Footer>
            <Btn onClick={() => { setError(''); setStep(2); }} disabled={!aadhaarFile}>
              Next: PAN Card →
            </Btn>
          </Footer>
        </div>
      )}

      {/* ── STEP 2: PAN Card + number ─────────────────────────────────── */}
      {step === 2 && (
        <div style={whiteCard()}>
          <StepHeading icon="pi-credit-card" title="Upload PAN Card" desc="Upload your PAN card and enter the 10-character PAN number." />
          <UploadArea
            label="PAN Card"
            icon="pi-credit-card"
            accept=".jpg,.jpeg,.png,.pdf"
            file={panFile}
            preview={panPrev}
            onChange={f => { setPanFile(f); makePreview(f, setPanPrev); }}
            large
          />
          <div style={{ marginTop: 20 }}>
            <label style={labelSt}>PAN Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. ABCDE1234F"
              value={panNumber}
              onChange={e => setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              style={inputSt}
            />
            {panNumber.length === 10 && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber) && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
              </p>
            )}
            {panNumber.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber) && (
              <p style={{ color: '#22c55e', fontSize: 12, marginTop: 4 }}><i className="pi pi-check" style={{ marginRight: 4 }} />PAN format valid</p>
            )}
          </div>
          <Footer>
            <Btn
              onClick={() => { setError(''); setStep(3); }}
              disabled={!panFile || panNumber.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)}
            >
              Next: Your Photo →
            </Btn>
          </Footer>
        </div>
      )}

      {/* ── STEP 3: Passport Photo / Selfie ───────────────────────────── */}
      {step === 3 && (
        <div style={whiteCard()}>
          <StepHeading icon="pi-camera" title="Upload Your Photo" desc="Take a live selfie or upload a recent passport-size photo." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Upload option */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}><i className="pi pi-upload" style={{ marginRight: 6 }} />Upload from device</p>
              <UploadArea
                label="Passport Photo"
                icon="pi-camera"
                accept="image/jpeg,image/png"
                file={selfieFile}
                preview={!captured ? selfiePrev : null}
                onChange={f => { setSelfieFile(f); makePreview(f, setSelfiePrev); setCaptured(false); stopCam(); }}
              />
            </div>

            {/* Webcam option */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}><i className="pi pi-video" style={{ marginRight: 6 }} />Use webcam</p>
              <div style={{
                border: `2px dashed ${captured ? '#22c55e' : '#cbd5e1'}`,
                borderRadius: 14, overflow: 'hidden', minHeight: 140,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', background: '#f8fafc', position: 'relative',
              }}>
                {camOn && (
                  <>
                    <video ref={videoRef} autoPlay playsInline
                      style={{ width: '100%', display: 'block', borderRadius: 10 }} />
                    <button onClick={captureSelfie} style={{
                      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                      background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 99,
                      padding: '8px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                    }}><i className="pi pi-camera" style={{ marginRight: 4 }} />Capture</button>
                  </>
                )}
                {!camOn && captured && selfiePrev && (
                  <>
                    <img src={selfiePrev} alt="captured"
                      style={{ width: '100%', display: 'block', borderRadius: 10, maxHeight: 160, objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, background: '#22c55e', color: '#fff',
                      borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}><i className="pi pi-check" style={{ marginRight: 3 }} />Captured</div>
                  </>
                )}
                {!camOn && !captured && (
                  <button onClick={startCam} style={camBtnSt}>
                    <i className="pi pi-video" style={{ fontSize: 30, color: '#3b82f6' }} />
                    <span style={{ fontSize: 13 }}>Open Camera</span>
                  </button>
                )}
              </div>
              {(captured || camOn) && (
                <button onClick={() => { setSelfieFile(null); setSelfiePrev(null); setCaptured(false); stopCam(); }}
                  style={{ marginTop: 6, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ↺ Retake / Change
                </button>
              )}
            </div>
          </div>

          {/* Preview of final selected photo */}
          {selfiePrev && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src={selfiePrev} alt="selfie preview" style={{
                width: 120, height: 120, objectFit: 'cover', borderRadius: 14,
                border: '3px solid #22c55e', boxShadow: '0 4px 14px rgba(34,197,94,0.25)',
              }} />
              <p style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginTop: 6 }}><i className="pi pi-check" style={{ marginRight: 4 }} />Photo ready</p>
            </div>
          )}

          <Footer>
            <Btn
              onClick={submitAlive}
              disabled={!selfieFile || submitting}
              loading={submitting}
            >
              Submit Documents →
            </Btn>
          </Footer>
        </div>
      )}

      {/* ── STEP 4: Video Call ────────────────────────────────────────── */}
      {step === 4 && (
        <div style={whiteCard({ textAlign: 'center' })}>
          {/* Doc summary thumbnails */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Aadhaar', preview: aadhaarPrev, icon: 'pi-id-card' },
              { label: 'PAN',     preview: panPrev,     icon: 'pi-credit-card' },
              { label: 'Photo',   preview: selfiePrev,  icon: 'pi-camera' },
            ].map(d => (
              <div key={d.label} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                  <i className={`pi ${d.icon}`} style={{ marginRight: 5 }} />{d.label}
                </div>
                {d.preview
                  ? <img src={d.preview} alt={d.label} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                  : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: '#22c55e', fontWeight: 600 }}><i className="pi pi-check" style={{ marginRight: 3 }} />Uploaded</div>
                }
              </div>
            ))}
          </div>

          {result?.match_score != null && (
            <ScoreBar score={result.match_score} style={{ marginBottom: 24 }} />
          )}

          {/* Main video CTA */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            border: '2px solid #bfdbfe', borderRadius: 18, padding: '2rem', marginBottom: 20,
          }}>
            <div style={{ marginBottom: 12 }}><i className="pi pi-video" style={{ fontSize: 44, color: '#1d4ed8' }} /></div>
            <h3 style={{ fontWeight: 800, color: '#1d4ed8', margin: '0 0 10px', fontSize: '1.3rem' }}>
              Join Live Video Call with Scheme Admin
            </h3>
            <p style={{ color: '#3b82f6', fontSize: 14, maxWidth: 420, margin: '0 auto 22px', lineHeight: 1.6 }}>
              Your documents have been submitted. An admin is ready to verify your identity
              via a short video call. Show your Aadhaar and PAN when asked.
            </p>
            <Btn onClick={openVideoCall} color="#1d4ed8" big>
              <i className="pi pi-video" style={{ marginRight: 6 }} />Verify by Video Call
            </Btn>
          </div>

          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
            padding: '14px 20px', fontSize: 13, color: '#166534', textAlign: 'left',
          }}>
            <strong>Tips for the video call:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.9 }}>
              <li>Keep your Aadhaar card and PAN card handy — you'll need to show them.</li>
              <li>Sit in a well-lit place facing the camera.</li>
              <li>The Jitsi room link stays active — you can rejoin if disconnected.</li>
              <li>Once the admin verifies you, your account will be marked approved.</li>
            </ul>
          </div>

          <button onClick={refreshStatus} style={refreshBtnSt}>
            <i className="pi pi-refresh" style={{ marginRight: 4 }} /> Check if I've been approved
          </button>
        </div>
      )}
    </Wrapper>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* Sub-components                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

function Wrapper({ children }) {
  return <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem' }}>{children}</div>;
}

function PageHeader({ title, sub, onBack }) {
  return (
    <div style={{ marginBottom: '1.8rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 14px',
          cursor: 'pointer', fontSize: 18, color: '#475569', marginTop: 2, flexShrink: 0,
        }}>←</button>
      )}
      <div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>{sub}</p>}
      </div>
    </div>
  );
}

function StepHeading({ icon, title, desc }) {
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <h2 style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '1.15rem' }}><i className={`pi ${icon}`} style={{ marginRight: 8 }} />{title}</h2>
      {desc && <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13.5 }}>{desc}</p>}
    </div>
  );
}

function Footer({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28,
      paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
      {children}
    </div>
  );
}

function UploadArea({ label, icon, accept, file, preview, onChange, large }) {
  const ref = useRef();
  const isPdf = file?.name?.endsWith('.pdf');
  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
      style={{
        border: `2px dashed ${preview ? '#22c55e' : '#cbd5e1'}`,
        borderRadius: 14, minHeight: large ? 170 : 130,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer',
        background: preview ? '#f0fdf4' : '#f8fafc',
        overflow: 'hidden', transition: 'all 0.2s', textAlign: 'center', padding: 16, gap: 8,
      }}>
      {preview ? (
        <>
          {isPdf
            ? <div><i className="pi pi-file-pdf" style={{ fontSize: 40, color: '#64748b' }} /></div>
            : <img src={preview} alt="preview" style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain', borderRadius: 10 }} />
          }
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
            <i className="pi pi-check" style={{ marginRight: 3 }} />{file?.name || 'File ready'}
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Click to replace</span>
        </>
      ) : (
        <>
          <i className={`pi ${icon}`} style={{ fontSize: 34, color: '#64748b' }} />
          <span style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>Click or drag to upload {label}</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>JPG, PNG or PDF — max 10 MB</span>
        </>
      )}
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

function ScoreBar({ score, style: sx }) {
  const c = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const lbl = score >= 80 ? 'Excellent match' : score >= 70 ? 'Good match — video call will confirm'
    : score >= 40 ? 'Moderate match — video call required' : 'Low match — please ensure clear documents';
  return (
    <div style={{ maxWidth: 380, margin: '0 auto', ...sx }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Document Photo Match</span>
        <strong style={{ color: c, fontSize: 13 }}>{score}%</strong>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 99, height: 10 }}>
        <div style={{ height: 10, borderRadius: 99, width: `${score}%`, background: c, transition: 'width 0.8s' }} />
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>{lbl}</p>
    </div>
  );
}

function ModeCard({ icon, title, desc, steps, color, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        border: `2px solid ${hov ? color : '#e2e8f0'}`, borderRadius: 18,
        padding: '2rem 1.5rem', cursor: 'pointer',
        background: hov ? `${color}10` : '#fff', textAlign: 'center',
        boxShadow: hov ? `0 8px 30px ${color}30` : '0 2px 12px rgba(0,0,0,0.05)',
        transform: hov ? 'translateY(-4px)' : 'none', transition: 'all 0.2s',
      }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}><i className={`pi ${icon}`} style={{ fontSize: 44, color }} /></div>
      <h3 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>{title}</h3>
      <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.6 }}>{desc}</p>
      <div style={{ textAlign: 'left', marginBottom: 18 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff',
              fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{i + 1}</div>
            <span style={{ fontSize: 13.5, color: '#374151' }}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{
        padding: '10px 0', borderRadius: 10, background: color,
        color: '#fff', fontWeight: 700, fontSize: 14,
      }}>Begin Verification →</div>
    </div>
  );
}

function ErrorBox({ msg, style: sx }) {
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
      padding: '12px 16px', color: '#dc2626', fontSize: 14, ...sx,
    }}><i className="pi pi-exclamation-triangle" style={{ marginRight: 6 }} />{msg}</div>
  );
}

function Btn({ children, onClick, disabled, loading, color = '#3b82f6', big }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      padding: big ? '14px 36px' : '11px 26px',
      borderRadius: 10, background: (disabled || loading) ? '#e2e8f0' : color,
      color: (disabled || loading) ? '#94a3b8' : '#fff', border: 'none',
      fontWeight: 700, fontSize: big ? 16 : 14, cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s',
    }}>
      {loading ? <><i className="pi pi-spin pi-spinner" style={{ marginRight: 4 }} /> Uploading documents…</> : children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0',
      background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer',
    }}>{children}</button>
  );
}

/* shared styles */
const whiteCard = (extra = {}) => ({
  background: '#fff', borderRadius: 20, padding: '2rem',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
  ...extra,
});
const labelSt = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 };
const inputSt = {
  width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 16,
  border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'monospace', letterSpacing: 4, textTransform: 'uppercase',
};
const camBtnSt = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  width: '100%', minHeight: 140,
};
const refreshBtnSt = {
  marginTop: 20, display: 'block', marginLeft: 'auto', marginRight: 'auto',
  background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 20px', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
