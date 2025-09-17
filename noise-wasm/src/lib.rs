use wasm_bindgen::prelude::*;

// Minimal Noise XX responder wrapper via snow
// NOTE: This is a skeleton. For production, add proper prologue binding and error handling.

#[wasm_bindgen]
pub struct Responder {
    hs: Option<snow::HandshakeState>,
    transport: Option<snow::TransportState>,
}

#[wasm_bindgen]
impl Responder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<Responder, JsValue> {
        let params: snow::params::NoiseParams = "Noise_XX_25519_ChaChaPoly_BLAKE2s".parse().map_err(|e| js_err(e))?;
        let builder = snow::Builder::new(params);
        let hs = builder.build_responder().map_err(|e| js_err(e))?;
        Ok(Responder { hs: Some(hs), transport: None })
    }

    // Process initiator message and produce response
    pub fn read_message(&mut self, msg: &[u8]) -> Result<Vec<u8>, JsValue> {
        if self.hs.is_some() {
            let hs = self.hs.as_mut().unwrap();
            let mut buf = vec![0u8; 1024];
            let len = hs.read_message(msg, &mut buf).map_err(|e| js_err(e))?;
            buf.truncate(len);
            if hs.is_handshake_finished() {
                let owned = self.hs.take().unwrap();
                let ts = owned.into_transport_mode().map_err(|e| js_err(e))?;
                self.transport = Some(ts);
            }
            Ok(buf)
        } else {
            Err(js_str("handshake already complete"))
        }
    }

    pub fn write_message(&mut self) -> Result<Vec<u8>, JsValue> {
        if self.hs.is_some() {
            let hs = self.hs.as_mut().unwrap();
            let mut buf = vec![0u8; 1024];
            let len = hs.write_message(&[], &mut buf).map_err(|e| js_err(e))?;
            buf.truncate(len);
            // Check completion
            if hs.is_handshake_finished() {
                let owned = self.hs.take().unwrap();
                let ts = owned.into_transport_mode().map_err(|e| js_err(e))?;
                self.transport = Some(ts);
            }
            Ok(buf)
        } else {
            Err(js_str("handshake already complete"))
        }
    }

    pub fn is_complete(&self) -> bool { self.transport.is_some() }

    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<Vec<u8>, JsValue> {
        if let Some(ts) = &mut self.transport {
            let mut out = vec![0u8; plaintext.len() + 16];
            let n = ts.write_message(plaintext, &mut out).map_err(|e| js_err(e))?;
            out.truncate(n);
            Ok(out)
        } else { Err(js_str("not ready")) }
    }

    pub fn decrypt(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>, JsValue> {
        if let Some(ts) = &mut self.transport {
            let mut out = vec![0u8; ciphertext.len()];
            let n = ts.read_message(ciphertext, &mut out).map_err(|e| js_err(e))?;
            out.truncate(n);
            Ok(out)
        } else { Err(js_str("not ready")) }
    }
}

fn js_err<E: core::fmt::Display>(e: E) -> JsValue { js_str(format!("{e}")) }
fn js_str<S: AsRef<str>>(s: S) -> JsValue { JsValue::from_str(s.as_ref()) }
