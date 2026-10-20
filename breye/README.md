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
| Foto ultra realistiche | AI Horde: Z-Image-Turbo, FLUX.1 Schnell e SDXL fotografici (Juggernaut XL, ICBINP XL…) a ~1 MP nativi, volti ritoccati, 2K nitida in locale | collegamento alla versione web |
| Ritocco generativo, inpainting, outpainting | AI Horde | collegamento alla versione web |
| Foto istantanee (motore Lampo) | Pollinations, modello Sana, con filigrana | non disponibile |
| Illustrazioni vettoriali | SVG scritti dal modello linguistico | idem |
| Scene 3D procedurali | shader GLSL scritti dal modello, resi sulla GPU | idem |
| Video con audio | Thorion Cinema: profondità 3D (Depth Anything V2 nel browser), vera camera 2.5D, suono d’ambiente sintetizzato, voce narrante, MP4 | stesso motore, profondità stimata |
| Voce | voci neurali Piper (Paola, Serena HD, Riccardo…) generate sul dispositivo | voce migliore del dispositivo |
| Mondi e giochi 3D | Thorion Engine (three.js): cielo fisico, PBR Poly Haven, ombre, SSAO, città open world, natura, auto guidabili | materiali e cielo procedurali |
| Ritocco, montaggio, musica, PDF | nel browser | nel browser |

Nessun motore richiede chiavi o account e nessuno ha una quota. AI Horde è una rete di GPU messe a disposizione da volontari: i modelli sono quelli che i volontari ospitano in quel momento, e le richieste anonime hanno la priorità più bassa. Una risposta in chat arriva di solito in 20–60 secondi, uno scatto in 1–3 minuti, una foto Thorion Pro in 3–6 minuti.

### Modelli di testo

Ogni richiesta nomina un'intera famiglia di modelli con lo stesso formato di prompt: la prima GPU libera che ne ospita uno risponde. L'ordine è:

1. **Qwen** grande (14B e oltre, per esempio Qwen 3.8 Max 27B) appena un volontario lo ospita;
2. **Skyfall 31B, Cydonia 24B, Magidonia 24B** (famiglia Mistral) per i compiti complessi: codice, agente, impaginazione;
3. per la chat, alla stessa famiglia si aggiungono **Rocinante 12B** e **Angelic Eclipse 12B**, più rapidi;
4. **Magnum 12B** (ChatML) e **Llama 3 8B** come riserva.

Le richieste anonime possono chiedere al massimo 512 token: le risposte più lunghe continuano da sole in più pezzi. Il modello Gemma 4 31B presente sulla rete è escluso, perché la sua catena di ragionamento ricomincia a ogni pezzo e non arriva alla risposta. In Impostazioni si può fissare un modello preferito.

### Foto indistinguibili da quelle vere

1. **Piano dello scatto**: il modello linguistico descrive una vera fotografia (soggetto, luce, inquadratura, fotocamera e obiettivo, texture reali) e sceglie un look.
2. **Due modelli in gara**: la richiesta parte insieme verso il miglior modello di ultima generazione disponibile (Z-Image-Turbo o FLUX.1 Schnell) e verso il miglior SDXL fotografico (Juggernaut XL, ICBINP XL, AlbedoBase XL): vince il primo scatto pronto, l’altro viene annullato. Ogni famiglia usa i parametri per cui è stata addestrata (passi, CFG, campionatore, scheduler) alla sua risoluzione nativa (~1 MP, 16:9, 9:16, 3:2…).
3. **Volti**: con persone in scena i modelli SDXL passano per CodeFormers sulla rete.
4. **2K nitida** sul dispositivo (ricampionamento di qualità e maschera di contrasto fine) e **finitura pellicola** delicata (Naturale, Portra 400, Cinestill, Ora d'oro, Cinema, Noir, Nitida).

### Thorion Cinema: video realistici con audio

Ogni foto diventa una scena 3D: **Depth Anything V2** calcola la profondità direttamente nel browser (WebGPU o WASM) e un renderer WebGL a ray-marching muove una vera camera dentro la foto (dolly, carrello, orbita, gru, messa a fuoco con profondità di campo, camera a mano), con atmosfera (pioggia, neve, polvere, braci) e grana di pellicola a 24 fps. La **colonna sonora** è sintetizzata sulla scena (pioggia e tuoni, mare, vento, bosco con uccelli, città con auto e clacson, folla, fuoco, ruscello, grilli, ambienti interni), con **voce narrante naturale** e musica facoltative, e viene inserita nell’MP4 (AAC/Opus).

### Voce naturale

La lettura ad alta voce usa voci neurali **Piper** (Paola, Serena HD, Serena, Riccardo; Emma e Ryan HD per l’inglese) sintetizzate sul dispositivo con onnxruntime-web in un worker: frase per frase, senza server e senza limiti. Il modello si scarica una sola volta e resta in cache; senza rete si usa la voce migliore del sistema.

### Thorion Engine

Un motore 3D realistico costruito su three.js, usato dall’agente con `make_3d` e scaricabile come **HTML autonomo** da inserire in qualsiasi sito:
- cielo fisico con ora del giorno e ciclo giorno/notte; il cielo illumina la scena (IBL), sole con ombre morbide che seguono il giocatore, SSAO, bloom, tone mapping filmico;
- materiali PBR reali di Poly Haven (asfalto, cemento, erba, roccia, legno, marmo…), alberi con chiome di foglie, erba mossa dal vento, lago con riflessi;
- **città open world** con traffico, pedoni animati, lampioni e finestre accese di notte, supercar realistica guidabile (E per salire/scendere); **natura**; **showroom**; scene **personalizzate**;
- terza persona, prima persona, orbita, guida; tastiera, mouse e comandi touch; pioggia, nebbia e neve;
- `custom_code` per programmare il mondo con l’API `E` (aggiungere oggetti, personaggi, auto, luci, regole di gioco).

In chat Thorion usa tutto come **strumenti** (`generate_photo`, `refine_detail`, `finish_photo`, `edit_photo`, `upscale_photo`, `remove_background`, `create_vector`, `make_video`, `make_3d`) e decide da sola la sequenza; i passaggi compaiono dal vivo nel messaggio.

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
  js/iris-tools.js    rete GPU comunitaria, foto in gara tra modelli, finitura pellicola, strumenti dell'agente
  js/voice.js         voce neurale Piper sul dispositivo (con riserva sulla voce di sistema)
  js/cinema.js        Thorion Cinema: profondità, camera 2.5D, suono d'ambiente, MP4 con audio
  js/engine/          Thorion Engine: motore 3D realistico che genera pagine HTML autonome
  js/*.js             una sezione per file
  assets/             logo e iride (sfondo trasparente, anello dorato)
```

Librerie open source caricate da cdnjs/jsDelivr: Fabric.js, CodeMirror, marked, DOMPurify, highlight.js, pdf.js, pdf-lib, jsPDF, html2canvas, JSZip, QRious, mammoth, turndown, mp4-muxer. Icone: sottoinsieme di Lucide (ISC).
