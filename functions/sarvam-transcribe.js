// Server-side proxy for Sarvam's speech-to-text REST endpoint.
// Cloudflare Pages Function — runs on Workers runtime (standard Fetch API,
// not Node.js), so this deliberately avoids Buffer/etc. and sticks to
// Web-platform APIs (atob, Uint8Array, Blob, FormData) that need no
// compatibility flags.
//
// Why this exists: Sarvam's docs don't document browser CORS support one
// way or the other, unlike Groq, OpenRouter, and Gemini which all do.
// Rather than find that out live during a presentation, this makes the
// call server-to-server, where CORS never applies. It also keeps
// SARVAM_API_KEY off the client entirely.
//
// File-based routing: functions/sarvam-transcribe.js -> POST /sarvam-transcribe
//
// Set SARVAM_API_KEY in Cloudflare: Workers & Pages -> your project ->
// Settings -> Environment variables (add it to both Production and Preview).

export async function onRequestPost(context) {
  const { request, env } = context;

  const SARVAM_API_KEY = env.SARVAM_API_KEY;
  if (!SARVAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "SARVAM_API_KEY is not set in this project's environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { audio_base64, mime_type, language_code } = payload;
  if (!audio_base64) {
    return new Response(JSON.stringify({ error: "Missing audio_base64 in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // base64 -> bytes, using standard Web APIs (no node:buffer needed)
    const binaryString = atob(audio_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime_type || "audio/webm" });

    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("language_code", language_code || "en-IN");

    const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": SARVAM_API_KEY },
      body: form
    });

    const text = await sarvamRes.text();
    return new Response(text, {
      status: sarvamRes.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
