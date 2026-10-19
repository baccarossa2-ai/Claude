<p align="center"><img src="assets/thorion-logo-256.webp" width="140" alt="Thorion"></p>

<h1 align="center">Thorion</h1>
<p align="center">Una sola chat. <b>Thorion Three&nbsp;3.3</b> ragiona e poi crea: testo, codice, foto e video ultra realistici, scene e giochi 3D.</p>

---

Thorion è un'app web con un'unica interfaccia: la chat. Scrivi quello che vuoi e **Thorion Three 3.3** ragiona, poi usa gli strumenti giusti (foto, video con audio, modelli e giochi 3D, codice, grafica). Gira interamente nel browser: niente installazione, niente chiavi API, le conversazioni restano sul dispositivo. Tutti i motori sono gratuiti e senza quota.

## Aprire l'app

- **Online**: apri `breye/index.html` da un hosting statico. Dal repository pubblico funziona subito con raw.githack, ad esempio
  `https://raw.githack.com/baccarossa2-ai/Claude/<branch>/breye/index.html`.
- **In locale**: `python3 -m http.server` dentro la cartella `breye/` e apri l'indirizzo che stampa.
- **Dentro Claude**: la versione pubblicata come Artifact usa Claude come motore (testo, codice, visione, strumenti). Le foto ultra realistiche richiedono la rete GPU comunitaria, raggiungibile solo dalla versione web: l'app mostra un collegamento che porta il prompt con sé (`?p=`).

## Il motore Thorion

| Funzione | Online (web pubblico) | Dentro Claude |
| --- | --- | --- |
| Chat, scrittura, codice | modelli aperti sulla rete GPU comunitaria AI Horde: una versione grande di Qwen quando un volontario la ospita, altrimenti Skyfall 31B, Cydonia e Magidonia 24B, Rocinante 12B | Claude, senza chiave |
| Descrizione di immagini | didascalie generate dalla stessa rete, lette dal modello linguistico | Claude (visione) |
| Testo da immagine (OCR) | Tesseract nel browser (italiano e inglese) | Claude (visione) |
| Agente con strumenti | strumenti descritti nel prompt, chiamati con blocchi `<tool>` | Claude (strumenti nativi) |
| Foto ultra realistiche | AI Horde (ICBINP, Realistic Vision, AbsoluteReality…) + finitura locale | collegamento alla versione web |
| Ritocco generativo, inpainting, outpainting | AI Horde | collegamento alla versione web |
| Foto istantanee (motore Lampo) | Pollinations, modello Sana, con filigrana | non disponibile |
| Illustrazioni vettoriali | SVG scritti dal modello linguistico | idem |
| Scene 3D procedurali | shader GLSL scritti dal modello, resi sulla GPU | idem |
| Video | foto realistiche animate in locale (camera, particelle, pellicola, musica) | scene 3D animate in locale |
| Ritocco, montaggio, musica, PDF | nel browser | nel browser |

Nessun motore richiede chiavi o account e nessuno ha una quota. AI Horde è una rete di GPU messe a disposizione da volontari: i modelli sono quelli che i volontari ospitano in quel momento, e le richieste anonime hanno la priorità più bassa. Una risposta in chat arriva di solito in 20–60 secondi, uno scatto in 1–3 minuti, una foto Thorion Pro in 3–6 minuti.

### Modelli di testo

Ogni richiesta nomina un'intera famiglia di modelli con lo stesso formato di prompt: la prima GPU libera che ne ospita uno risponde. L'ordine è:

1. **Qwen** grande (14B e oltre, per esempio Qwen 3.8 Max 27B) appena un volontario lo ospita;
2. **Skyfall 31B, Cydonia 24B, Magidonia 24B** (famiglia Mistral) per i compiti complessi: codice, agente, impaginazione;
3. per la chat, alla stessa famiglia si aggiungono **Rocinante 12B** e **Angelic Eclipse 12B**, più rapidi;
4. **Magnum 12B** (ChatML) e **Llama 3 8B** come riserva.

Le richieste anonime possono chiedere al massimo 512 token: le risposte più lunghe continuano da sole in più pezzi. Il modello Gemma 4 31B presente sulla rete è escluso, perché la sua catena di ragionamento ricomincia a ogni pezzo e non arriva alla risposta. In Impostazioni si può fissare un modello preferito.

### Realismo a basso consumo di GPU

Thorion chiede alla rete solo immagini piccole (al massimo 576×576, il formato più economico) e fa il resto sul tuo dispositivo:

1. **Piano dello scatto**: il modello linguistico scrive un prompt fotografico (luce, obiettivo, diaframma, pellicola, texture) e sceglie un look.
2. **Scatto** con un modello fotografico sulla rete comunitaria.
3. **Rifinitura a tasselli** (qualità Pro): l'immagine viene ingrandita e rigenerata a tasselli di 576 px con bassa intensità; la separazione delle frequenze tiene colori e luce dell'originale e prende solo il dettaglio nuovo (pelle, tessuti, materiali).
4. **Finitura pellicola** locale: curva filmica, micro-contrasto, halation, aberrazione cromatica, split toning, vignettatura e grana (Naturale, Portra 400, Cinestill, Ora d'oro, Cinema, Noir, Nitida).

In chat Thorion usa questi passaggi come **strumenti** (`generate_photo`, `refine_detail`, `finish_photo`, `edit_photo`, `upscale_photo`, `remove_background`, `create_vector`, `make_video` (con audio), `make_3d` (scene e giochi Three.js)) e decide da sola la sequenza; i passaggi compaiono dal vivo nel messaggio.

## Cosa fa Thorion (strumenti dell'agente in chat)

- **Thorion Chat**: conversazioni salvate, streaming, Markdown e codice evidenziato, allegati (immagini, testi, PDF), personalità (scrittrice, sviluppatrice, traduttrice…), agente creativo con strumenti reali (foto ultra realistiche, ritocchi, scontorni, vettoriali, video), immagini rapide con `/immagine`.
- **Immagini AI**: Thorion Pro e Thorion Foto (rete GPU comunitaria), Lampo, Vettoriale e Procedurale 3D; passaggi dal vivo, look pellicola, 13 stili, 7 formati, varianti in parallelo, prompt negativo, rifinitura/finitura/ingrandimento dei risultati, galleria locale, scene GPU dal vivo.
- **Video AI**: dall'idea allo storyboard (scene, testi, camera, particelle, transizioni “iride” e “battito di ciglia”), musica generata, foto animate, export MP4.
- **Design Studio**: Fabric.js, 12 modelli adattivi, 15 formati, forme, 330 icone, adesivi, 47 font, abbinamenti tipografici, sfondi e gradienti, palette di brand, livelli, pagine multiple, Magic Resize, Magic Design, Magic Write, assistente che modifica il design a parole, export PNG/JPG/SVG/PDF/ZIP.
- **Foto Studio**: livelli con fusioni e opacità, 20 strumenti (pennello, gomma, selezioni, lazo, bacchetta magica, ritaglio, secchiello, sfumatura, testo, forme, contagocce, timbro clone, rimozione oggetti, sfoca, schiarisci/brucia), 18 regolazioni, 13 filtri, auto-miglioramento, color grading da testo, rimozione sfondo, riempimento generativo (inpainting), espansione (outpainting), Realismo Pro (rifinitura a tasselli e finitura pellicola), ingrandimento 2×.
- **Video Editor**: timeline a 5 tracce, trascinamento e rifilatura, divisione, velocità, volume e dissolvenze, 11 filtri, 10 transizioni, testi con 7 stili e animazioni, taglio automatico dei silenzi, sottotitoli parola per parola da script, script AI, musica AI, export MP4 con WebCodecs.
- **Code Studio**: CodeMirror, più file, anteprima dal vivo su desktop/tablet/telefono, console, modelli, programmatrice AI che crea e corregge interi progetti, export ZIP o file unico.
- **Documenti & PDF**: editor con scrittura AI e trasformazioni del testo, modelli, import DOCX/MD/HTML, export PDF/Word/Markdown/HTML; unisci, estrai, ruota, riordina, duplica pagine, immagini in PDF, PDF in immagini, filigrana, numeri di pagina, chat con il PDF.
- **Strumenti**: rimozione sfondo, conversione e compressione, palette da foto e da testo, QR, gradienti, musica, OCR, collage, icone app, lettura vocale, nomi e slogan.

## Struttura

```
breye/
  index.html          pagina dell'app
  css/breye.css       sistema di design (palette dell'iride, componenti, shell)
  css/studios.css     stili delle sezioni
  js/core.js          utilità, archivio IndexedDB, router, finestre, comandi
  js/ai.js            motore Thorion (testo, strumenti, immagini) e runner degli shader
  js/iris-tools.js    rete GPU comunitaria, rifinitura a tasselli, finitura pellicola, strumenti dell'agente
  js/*.js             una sezione per file
  assets/             logo e iride (sfondo trasparente, anello dorato)
```

Librerie open source caricate da cdnjs/jsDelivr: Fabric.js, CodeMirror, marked, DOMPurify, highlight.js, pdf.js, pdf-lib, jsPDF, html2canvas, JSZip, QRious, mammoth, turndown, mp4-muxer. Icone: sottoinsieme di Lucide (ISC).
