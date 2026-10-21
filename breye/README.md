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
| Chat, ricerche, ragionamenti, allegati | **Three 3.3 Veloce**: GPT-OSS 20B (OpenAI, open weights) su Pollinations, in streaming, con ragionamento | Claude, senza chiave |
| Codice, siti, giochi, grafici, 3D, regia di foto/video/audio | **Three 3.3 Forte**: Qwen 3.5 122B sulla rete GPU comunitaria AI Horde (riserva: Skyfall 31B, Cydonia 24B…) | Claude, senza chiave |
| Ricerca sul web | DuckDuckGo e Wikipedia (italiano e inglese) con fonti citate; le pagine linkate nel messaggio vengono lette | non disponibile |
| Descrizione di immagini | didascalie generate dalla stessa rete, lette dal modello linguistico | Claude (visione) |
| Testo da immagine (OCR) | Tesseract nel browser (italiano e inglese) | Claude (visione) |
| Agente con strumenti | strumenti descritti nel prompt, chiamati con blocchi `<tool>` | Claude (strumenti nativi) |
| Foto ultra realistiche | AI Horde: Z-Image-Turbo, FLUX.1 Schnell e SDXL fotografici (Juggernaut XL, ICBINP XL…) a ~1 MP nativi, volti ritoccati, 2K nitida in locale | collegamento alla versione web |
| Ritocco generativo, inpainting, outpainting | AI Horde | collegamento alla versione web |
| Foto istantanee (motore Lampo) | Pollinations, modello Sana, con filigrana | non disponibile |
| Illustrazioni vettoriali | SVG scritti dal modello linguistico | idem |
| Scene 3D procedurali | shader GLSL scritti dal modello, resi sulla GPU | idem |
| Video con audio | Thorion Cinema: profondità 3D (Depth Anything V2 nel browser), vera camera 2.5D, suono d’ambiente sintetizzato, voce narrante, MP4 | stesso motore, profondità stimata |
| Voce | voci neurali Piper generate sul dispositivo: italiano (Paola, Serena HD, Serena, Riccardo), inglese (Emma, Ryan HD, Alan), spagnolo, francese, tedesco; voiceover e podcast con musica sotto | voce migliore del dispositivo |
| Mondi e giochi 3D | Thorion Engine (three.js): cielo fisico, PBR Poly Haven, ombre, SSAO, città open world, natura, auto guidabili | materiali e cielo procedurali |
| Modelli 3D (GLB, STL, OBJ) | Thorion Forge: da foto, allegato o testo (volume ricostruito + profondità neurale) o da codice three.js; modelli 3D allegati visualizzati e messi in scena | dagli allegati, profondità stimata |
| Grafici | Chart.js: barre, linee, aree, torte, radar, dispersione, grafici di funzioni | idem |
| Musica | **MusicGen** (Meta) sul dispositivo: brani strumentali di ogni genere; riserva: sintetizzatore Thorion | sintetizzatore Thorion |
| Ritocco, montaggio, musica, PDF | nel browser | nel browser |

Nessun motore richiede chiavi o account e nessuno ha una quota. AI Horde è una rete di GPU messe a disposizione da volontari: i modelli sono quelli che i volontari ospitano in quel momento, e le richieste anonime hanno la priorità più bassa. Una risposta in chat arriva di solito in 20–60 secondi, uno scatto in 1–3 minuti, una foto Thorion Pro in 3–6 minuti.

### Due modelli: Veloce e Forte

Thorion sceglie da sola il modello per ogni messaggio:

- **Three 3.3 Veloce** (GPT-OSS 20B, open weights di OpenAI, su Pollinations): conversazione, domande, ragionamenti, riassunti, traduzioni, allegati e ricerche sul web. È gratuito, senza chiavi e risponde in streaming in pochi secondi. Quando una domanda riguarda fatti (chi, cosa, quando, dove, notizie…) Thorion cerca prima su DuckDuckGo e Wikipedia e cita le fonti; i link nel messaggio vengono letti.
- **Three 3.3 Forte** (Qwen 3.5 122B sulla rete AI Horde): tutto ciò che si costruisce, cioè codice, siti, giochi, matematica, grafici, modelli e mondi 3D, e la regia di foto, video, musica e voci con gli strumenti. Le richieste anonime arrivano a 512 token per volta e le risposte lunghe continuano da sole in più pezzi.

Ognuno fa da riserva all'altro, e sotto ogni risposta compare il modello che l'ha scritta.

### Foto indistinguibili da quelle vere

1. **Piano dello scatto**: il modello linguistico descrive una vera fotografia (soggetto, luce, inquadratura, fotocamera e obiettivo, texture reali) e sceglie un look.
2. **Due modelli in gara**: la richiesta parte insieme verso il miglior modello di ultima generazione disponibile (Z-Image-Turbo o FLUX.1 Schnell) e verso il miglior SDXL fotografico (Juggernaut XL, ICBINP XL, AlbedoBase XL): vince il primo scatto pronto, l’altro viene annullato. Ogni famiglia usa i parametri per cui è stata addestrata (passi, CFG, campionatore, scheduler) alla sua risoluzione nativa (~1 MP, 16:9, 9:16, 3:2…).
3. **Volti**: con persone in scena i modelli SDXL passano per CodeFormers sulla rete.
4. **2K nitida** sul dispositivo (ricampionamento di qualità e maschera di contrasto fine) e **finitura pellicola** delicata (Naturale, Portra 400, Cinestill, Ora d'oro, Cinema, Noir, Nitida).

### Thorion Cinema: video realistici con audio

Ogni foto diventa una scena 3D: **Depth Anything V2** calcola la profondità direttamente nel browser (WebGPU o WASM) e un renderer WebGL a ray-marching muove una vera camera dentro la foto (dolly, carrello, orbita, gru, messa a fuoco con profondità di campo, camera a mano), con atmosfera (pioggia, neve, polvere, braci) e grana di pellicola a 24 fps. La **colonna sonora** è sintetizzata sulla scena (pioggia e tuoni, mare, vento, bosco con uccelli, città con auto e clacson, folla, fuoco, ruscello, grilli, ambienti interni), con **voce narrante naturale** e musica facoltative, e viene inserita nell’MP4 (AAC/Opus).

### Accesso con Google e priorità

AI Horde è gratuita e illimitata, ma le richieste anonime condividono un unico account in fondo alla coda. Con **Accedi con Google** (barra laterale) si entra su AI Horde con Google, si copia la propria API key e la si incolla in Thorion: da quel momento foto, fotogrammi e risposte hanno la precedenza sulla coda anonima, sempre gratis e senza limiti. Mentre lo scatto ultra realistico è in coda compare un'**anteprima istantanea**. Le chat restano salvate sul dispositivo e dal menu “…” si possono esportare e ripristinare.

### Voce naturale

La lettura ad alta voce usa voci neurali **Piper** (Paola, Serena HD, Serena, Riccardo; Emma e Ryan HD per l’inglese) sintetizzate sul dispositivo con onnxruntime-web in un worker: frase per frase, senza server e senza limiti. Il modello si scarica una sola volta e resta in cache; senza rete si usa la voce migliore del sistema.

### Thorion Engine

Un motore 3D realistico costruito su three.js, usato dall’agente con `make_3d` e scaricabile come **HTML autonomo** da inserire in qualsiasi sito:
- cielo fisico con ora del giorno e ciclo giorno/notte; il cielo illumina la scena (IBL), sole con ombre morbide che seguono il giocatore, SSAO, bloom, tone mapping filmico;
- materiali PBR reali di Poly Haven (asfalto, cemento, erba, roccia, legno, marmo…), alberi con chiome di foglie, erba mossa dal vento, lago con riflessi;
- **città open world** con traffico, pedoni animati, lampioni e finestre accese di notte, supercar realistica guidabile (E per salire/scendere); **natura**; **showroom**; scene **personalizzate**;
- terza persona, prima persona, orbita, guida; tastiera, mouse e comandi touch; pioggia, nebbia e neve;
- `custom_code` per programmare il mondo con l’API `E` (aggiungere oggetti, personaggi, auto, luci, regole di gioco).

### Thorion Forge: grafici, musica, voci e modelli 3D

- **Grafici** (`make_chart`): barre, barre orizzontali, linee, aree, torte e ciambelle con percentuali, radar, dispersione e bolle, e grafici di funzioni (`x^2-3x+2`, `sin(x)`, `ln(x)`…) con gli asintoti gestiti. PNG nitido a 1600 px.
- **Musica** (`make_music`): **MusicGen** di Meta gira nel browser (WebGPU dove c'è, altrimenti WASM). Il modello (circa 650 MB) si scarica una sola volta. Genera da 6 a 30 secondi di musica vera, poi estende il brano alla durata richiesta con dissolvenze incrociate. Su CPU 10 secondi di musica richiedono circa un minuto e mezzo. Il risultato è un WAV stereo. Se il modello non è raggiungibile, Thorion usa il suo sintetizzatore.
- **Voci** (`make_voice`): voiceover, podcast, audiolibri e annunci con le voci Piper. Si può mettere sotto una musica creata con `make_music`: la musica si abbassa da sola mentre la voce parla.
- **Modelli 3D**:
  - `make_3d_model` crea il modello da una foto, da un allegato o da un testo (prima genera la foto del soggetto). Separa il soggetto dallo sfondo e ne ricostruisce un volume pieno e chiuso: l'inflazione di Poisson dà sezioni rotonde, poi la profondità neurale di Depth Anything scolpisce i dettagli e la foto diventa la texture. Senza un soggetto isolato crea un bassorilievo.
  - `build_3d_model` costruisce oggetti precisi (mobili, edifici, veicoli, asset di gioco) con codice three.js, che gira in un frame isolato.
  - `stage_3d_model` mette qualsiasi modello in una vetrina girevole, nella natura o in città con il Thorion Engine.
  - Ogni modello si ruota nel visualizzatore (con realtà aumentata sul telefono) e si scarica in **GLB**, **STL** (100 mm, pronto per la stampa 3D) e **OBJ**. In chat si possono allegare modelli **GLB, glTF, STL e OBJ**.

In chat Thorion usa tutto come **strumenti** (`generate_photo`, `refine_detail`, `finish_photo`, `edit_photo`, `upscale_photo`, `remove_background`, `create_vector`, `make_video`, `make_3d`, `make_chart`, `make_music`, `make_voice`, `make_3d_model`, `build_3d_model`, `stage_3d_model`) e decide da sola la sequenza; i passaggi compaiono dal vivo nel messaggio.

## Cosa fa Thorion (strumenti dell'agente in chat)

- **Thorion Chat**: conversazioni salvate (anche nel cloud, cifrate), streaming, Markdown e codice evidenziato, ricerca sul web con fonti, allegati (immagini, testi, PDF, modelli 3D), agente creativo con strumenti reali (foto ultra realistiche, ritocchi, scontorni, vettoriali, video con audio, grafici, musica, voci, modelli e mondi 3D), immagini rapide con `/immagine`.
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
  js/forge.js         Thorion Forge: grafici, musica MusicGen, voci, modelli 3D (GLB/STL/OBJ)
  js/engine/          Thorion Engine: motore 3D realistico che genera pagine HTML autonome
  js/*.js             una sezione per file
  assets/             logo e iride (sfondo trasparente, anello dorato)
```

Librerie open source caricate da cdnjs/jsDelivr: three.js, transformers.js (MusicGen, Depth Anything), onnxruntime-web, Chart.js, model-viewer, Fabric.js, CodeMirror, marked, DOMPurify, highlight.js, pdf.js, pdf-lib, jsPDF, html2canvas, JSZip, QRious, mammoth, turndown, mp4-muxer. Icone: sottoinsieme di Lucide (ISC).
