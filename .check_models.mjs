import fs from 'fs';

const envContent = fs.readFileSync('.env.example', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim()];
    })
);

const apiKey = env.GEMINI_API_KEY;

async function listModels() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.statusText}`);
    }
    const data = await res.json();
    console.log("Supported Gemini Models for generateContent:");
    data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
      .forEach(m => {
        console.log(`- ${m.name.replace('models/', '')}`);
      });
  } catch(e) {
    console.error(e);
  }
}

listModels();
