import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Check, FileImage, FilePlus2, FileText,
  ClipboardList, FolderOpen, Home, LockKeyhole, Mic, ShieldCheck, Trash2, Upload, UserRound,
  Volume2, WandSparkles,
} from 'lucide-react';
import { DOCUMENT_CATEGORIES, FORMS, LANGUAGES, PROFILE_FIELDS, STATES, type FormService } from './saathi-data';
import { FormAssistance } from './FormAssistance';

type Account = { email: string; salt: string; authIv: string; authVerifier: string; language: string; ui: 'hi'|'en' };
type Profile = Record<string, string>;
type StoredDocument = { id: string; name: string; category: string; mime: string; size: number; blob: Blob; createdAt: number };
type EncryptedDocument = Omit<StoredDocument, 'blob'> & { iv: string; ciphertext: string };
type Ciphertext = { iv: string; ciphertext: string };
type ToolSettings = { targetKB: number; maxDimension: number; outputType: string; rotation: number; operation: string; splitPages: string };
type Processed = { blob: Blob; name: string; before: number; after: number; message: string; type: string };
const defaultSettings: ToolSettings = { targetKB: 100, maxDimension: 1600, outputType: 'image/jpeg', rotation: 0, operation: 'compress', splitPages: '1' };
const categories = DOCUMENT_CATEGORIES;
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) { reject(new Error('यह ब्राउज़र स्थानीय डेटा सुरक्षित नहीं रख सकता।')); return; }
  const req = indexedDB.open('sarkari-saathi-local', 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('स्थानीय स्टोरेज नहीं खुला।'));
});
async function dbAction<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore)=>IDBRequest<T>): Promise<T> {
  const db = await dbPromise;
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const bytesLabel = (n:number) => n > 1024*1024 ? `${(n/1048576).toFixed(2)} MB` : `${Math.max(1,Math.round(n/1024))} KB`;
const SHELL_COPY: Record<string, Record<string,string>> = {
  'hi-IN': {home:'घर',tools:'फाइल के औज़ार',details:'मेरी जानकारी',assist:'फॉर्म मदद',hero:'आपकी मदद, आपकी भाषा में',headline:'कागज़ी काम, अब थोड़ा आसान।',intro:'अपनी जानकारी इसी डिवाइस पर रखें। फ़ोटो और PDF को सरकारी फॉर्म के लिए तैयार करें।',need:'आज किस काम में मदद चाहिए?',start:'दो आसान शुरुआत',toolCard:'फ़ोटो या PDF छोटा करें',toolDesc:'साइज़ बदलें, घुमाएँ, जोड़ें या अलग करें',detailsCard:'मेरी जानकारी सेव करें',detailsDesc:'अपने कागज़ों के लिए जानकारी यहाँ रखें',assistCard:'फॉर्म भरने में मदद',assistDesc:'लेबल से सेव जानकारी का स्थानीय मिलान'},
  'bn-IN': {home:'হোম',tools:'ফাইলের সরঞ্জাম',details:'আমার তথ্য',assist:'ফর্ম সহায়তা',hero:'আপনার ভাষায় সহায়তা',headline:'কাগজপত্র, একটু সহজ।',intro:'আপনার তথ্য এই ডিভাইসেই রাখুন। সরকারি ফর্মের জন্য ছবি ও PDF প্রস্তুত করুন।',need:'আজ কী কাজে সাহায্য দরকার?',start:'শুরু করার দুটি সহজ পথ',toolCard:'ছবি বা PDF ছোট করুন',toolDesc:'আকার বদলান, ঘোরান, জুড়ুন বা ভাগ করুন',detailsCard:'আমার তথ্য সংরক্ষণ করুন',detailsDesc:'কাগজপত্রের জন্য তথ্য এখানে রাখুন',assistCard:'ফর্ম পূরণে সহায়তা',assistDesc:'লেবেলের সঙ্গে সংরক্ষিত তথ্য স্থানীয়ভাবে মেলান'},
  'ta-IN': {home:'முகப்பு',tools:'கோப்பு கருவிகள்',details:'என் விவரங்கள்',assist:'படிவ உதவி',hero:'உங்கள் மொழியில் உதவி',headline:'காகிதப் பணிகள் இனி சற்றே எளிது.',intro:'உங்கள் விவரங்களை இந்தச் சாதனத்தில் வைத்திருங்கள். அரசு படிவங்களுக்காகப் படங்களையும் PDF-களையும் தயார் செய்யுங்கள்.',need:'இன்று எதில் உதவி தேவை?',start:'தொடங்க இரண்டு எளிய வழிகள்',toolCard:'படம் அல்லது PDF அளவை மாற்று',toolDesc:'அளவு மாற்று, சுழற்று, சேர் அல்லது பிரி',detailsCard:'என் விவரங்களைச் சேமி',detailsDesc:'ஆவணங்களுக்கான விவரங்களை இங்கே வையுங்கள்',assistCard:'படிவம் நிரப்ப உதவி',assistDesc:'லேபிள்களுடன் சேமித்த விவரங்களை உள்ளூரில் பொருத்து'},
  'te-IN': {home:'హోమ్',tools:'ఫైల్ సాధనాలు',details:'నా వివరాలు',assist:'ఫారమ్ సహాయం',hero:'మీ భాషలో సహాయం',headline:'పత్రాల పని, ఇక కాస్త సులభం.',intro:'మీ వివరాలను ఈ పరికరంలోనే ఉంచండి. ప్రభుత్వ ఫారమ్‌ల కోసం ఫోటోలు, PDFలను సిద్ధం చేయండి.',need:'ఈ రోజు ఏ విషయంలో సహాయం కావాలి?',start:'ప్రారంభించడానికి రెండు సులభ మార్గాలు',toolCard:'ఫోటో లేదా PDF పరిమాణం మార్చండి',toolDesc:'పరిమాణం మార్చండి, తిప్పండి, కలపండి లేదా విడదీయండి',detailsCard:'నా వివరాలను సేవ్ చేయండి',detailsDesc:'పత్రాల కోసం వివరాలను ఇక్కడ ఉంచండి',assistCard:'ఫారమ్ నింపే సహాయం',assistDesc:'లేబుళ్లను సేవ్ చేసిన వివరాలతో స్థానికంగా సరిపోల్చండి'},
  'mr-IN': {home:'मुख्यपृष्ठ',tools:'फाइल साधने',details:'माझी माहिती',assist:'फॉर्म मदत',hero:'तुमच्या भाषेत मदत',headline:'कागदपत्रांचे काम, आता थोडे सोपे.',intro:'तुमची माहिती याच डिव्हाइसवर ठेवा. सरकारी फॉर्मसाठी फोटो आणि PDF तयार करा.',need:'आज कशासाठी मदत हवी?',start:'सुरुवात करण्याचे दोन सोपे मार्ग',toolCard:'फोटो किंवा PDF लहान करा',toolDesc:'आकार बदला, फिरवा, जोडा किंवा वेगळे करा',detailsCard:'माझी माहिती जतन करा',detailsDesc:'कागदपत्रांसाठी माहिती येथे ठेवा',assistCard:'फॉर्म भरण्यास मदत',assistDesc:'लेबल आणि जतन केलेली माहिती स्थानिकरीत्या जुळवा'},
  'gu-IN': {home:'હોમ',tools:'ફાઇલ સાધનો',details:'મારી માહિતી',assist:'ફોર્મ મદદ',hero:'તમારી ભાષામાં મદદ',headline:'કાગળનું કામ, હવે થોડું સરળ.',intro:'તમારી માહિતી આ ઉપકરણમાં જ રાખો. સરકારી ફોર્મ માટે ફોટા અને PDF તૈયાર કરો.',need:'આજે શેમાં મદદ જોઈએ?',start:'શરૂઆતના બે સરળ રસ્તા',toolCard:'ફોટો અથવા PDF નાનું કરો',toolDesc:'માપ બદલો, ફેરવો, જોડો અથવા અલગ કરો',detailsCard:'મારી માહિતી સાચવો',detailsDesc:'દસ્તાવેજો માટે માહિતી અહીં રાખો',assistCard:'ફોર્મ ભરવામાં મદદ',assistDesc:'લેબલ અને સાચવેલી માહિતીનો સ્થાનિક મેળ'},
  'kn-IN': {home:'ಮುಖಪುಟ',tools:'ಫೈಲ್ ಪರಿಕರಗಳು',details:'ನನ್ನ ವಿವರಗಳು',assist:'ಫಾರ್ಮ್ ಸಹಾಯ',hero:'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಸಹಾಯ',headline:'ಕಾಗದದ ಕೆಲಸ, ಈಗ ಸ್ವಲ್ಪ ಸುಲಭ.',intro:'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಈ ಸಾಧನದಲ್ಲೇ ಇರಿಸಿ. ಸರ್ಕಾರಿ ಫಾರ್ಮ್‌ಗಳಿಗಾಗಿ ಫೋಟೋ ಮತ್ತು PDF ಸಿದ್ಧಪಡಿಸಿ.',need:'ಇಂದು ಯಾವುದಕ್ಕೆ ಸಹಾಯ ಬೇಕು?',start:'ಆರಂಭಿಸಲು ಎರಡು ಸರಳ ಮಾರ್ಗಗಳು',toolCard:'ಫೋಟೋ ಅಥವಾ PDF ಗಾತ್ರ ಬದಲಿಸಿ',toolDesc:'ಗಾತ್ರ ಬದಲಿಸಿ, ತಿರುಗಿಸಿ, ಸೇರಿಸಿ ಅಥವಾ ಬೇರ್ಪಡಿಸಿ',detailsCard:'ನನ್ನ ವಿವರಗಳನ್ನು ಉಳಿಸಿ',detailsDesc:'ದಾಖಲೆಗಳಿಗಾಗಿ ವಿವರಗಳನ್ನು ಇಲ್ಲಿ ಇರಿಸಿ',assistCard:'ಫಾರ್ಮ್ ಭರ್ತಿ ಸಹಾಯ',assistDesc:'ಲೇಬಲ್‌ಗಳನ್ನು ಉಳಿಸಿದ ವಿವರಗಳೊಂದಿಗೆ ಸ್ಥಳೀಯವಾಗಿ ಹೊಂದಿಸಿ'},
  'ml-IN': {home:'ഹോം',tools:'ഫയൽ ഉപകരണങ്ങൾ',details:'എന്റെ വിവരങ്ങൾ',assist:'ഫോം സഹായം',hero:'നിങ്ങളുടെ ഭാഷയിൽ സഹായം',headline:'കടലാസ് ജോലികൾ, ഇനി കുറച്ച് എളുപ്പം.',intro:'നിങ്ങളുടെ വിവരങ്ങൾ ഈ ഉപകരണത്തിൽ തന്നെ സൂക്ഷിക്കുക. സർക്കാർ ഫോമുകൾക്കായി ചിത്രങ്ങളും PDF-കളും തയ്യാറാക്കുക.',need:'ഇന്ന് എന്തിലാണ് സഹായം വേണ്ടത്?',start:'തുടങ്ങാൻ രണ്ട് എളുപ്പവഴികൾ',toolCard:'ചിത്രം അല്ലെങ്കിൽ PDF ചെറുതാക്കുക',toolDesc:'വലുപ്പം മാറ്റുക, തിരിക്കുക, ചേർക്കുക അല്ലെങ്കിൽ വേർതിരിക്കുക',detailsCard:'എന്റെ വിവരങ്ങൾ സൂക്ഷിക്കുക',detailsDesc:'രേഖകൾക്കായുള്ള വിവരങ്ങൾ ഇവിടെ വയ്ക്കുക',assistCard:'ഫോം പൂരിപ്പിക്കാൻ സഹായം',assistDesc:'ലേബലുകൾ സംരക്ഷിച്ച വിവരങ്ങളുമായി ഉപകരണത്തിൽ തന്നെ പൊരുത്തപ്പെടുത്തുക'},
  'pa-IN': {home:'ਮੁੱਖ ਪੰਨਾ',tools:'ਫਾਈਲ ਟੂਲ',details:'ਮੇਰੀ ਜਾਣਕਾਰੀ',assist:'ਫਾਰਮ ਮਦਦ',hero:'ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਮਦਦ',headline:'ਕਾਗਜ਼ੀ ਕੰਮ, ਹੁਣ ਕੁਝ ਸੌਖਾ।',intro:'ਆਪਣੇ ਵੇਰਵੇ ਇਸੇ ਡਿਵਾਈਸ ਉੱਤੇ ਰੱਖੋ। ਸਰਕਾਰੀ ਫਾਰਮਾਂ ਲਈ ਫੋਟੋ ਅਤੇ PDF ਤਿਆਰ ਕਰੋ।',need:'ਅੱਜ ਕਿਸ ਕੰਮ ਵਿੱਚ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?',start:'ਸ਼ੁਰੂ ਕਰਨ ਦੇ ਦੋ ਸੌਖੇ ਤਰੀਕੇ',toolCard:'ਫੋਟੋ ਜਾਂ PDF ਛੋਟੀ ਕਰੋ',toolDesc:'ਆਕਾਰ ਬਦਲੋ, ਘੁਮਾਓ, ਜੋੜੋ ਜਾਂ ਵੱਖ ਕਰੋ',detailsCard:'ਮੇਰੀ ਜਾਣਕਾਰੀ ਸੰਭਾਲੋ',detailsDesc:'ਕਾਗਜ਼ਾਂ ਲਈ ਵੇਰਵੇ ਇੱਥੇ ਰੱਖੋ',assistCard:'ਫਾਰਮ ਭਰਨ ਵਿੱਚ ਮਦਦ',assistDesc:'ਲੇਬਲਾਂ ਨੂੰ ਸੰਭਾਲੇ ਵੇਰਵਿਆਂ ਨਾਲ ਇੱਥੇ ਹੀ ਮਿਲਾਓ'},
  'or-IN': {home:'ମୂଳପୃଷ୍ଠା',tools:'ଫାଇଲ୍ ଉପକରଣ',details:'ମୋ ତଥ୍ୟ',assist:'ଫର୍ମ ସହାୟତା',hero:'ଆପଣଙ୍କ ଭାଷାରେ ସହାୟତା',headline:'କାଗଜପତ୍ର କାମ, ଏବେ ଟିକେ ସହଜ।',intro:'ଆପଣଙ୍କ ତଥ୍ୟ ଏହି ଡିଭାଇସ୍‌ରେ ରଖନ୍ତୁ। ସରକାରୀ ଫର୍ମ ପାଇଁ ଫଟୋ ଓ PDF ପ୍ରସ୍ତୁତ କରନ୍ତୁ।',need:'ଆଜି କେଉଁ କାମରେ ସହାୟତା ଦରକାର?',start:'ଆରମ୍ଭ ପାଇଁ ଦୁଇଟି ସହଜ ଉପାୟ',toolCard:'ଫଟୋ କିମ୍ବା PDF ଛୋଟ କରନ୍ତୁ',toolDesc:'ଆକାର ବଦଳାନ୍ତୁ, ଘୂରାନ୍ତୁ, ଯୋଡ଼ନ୍ତୁ କିମ୍ବା ଅଲଗା କରନ୍ତୁ',detailsCard:'ମୋ ତଥ୍ୟ ସଞ୍ଚୟ କରନ୍ତୁ',detailsDesc:'କାଗଜପତ୍ର ପାଇଁ ତଥ୍ୟ ଏଠାରେ ରଖନ୍ତୁ',assistCard:'ଫର୍ମ ପୂରଣ ସହାୟତା',assistDesc:'ଲେବଲ୍‌କୁ ସଞ୍ଚିତ ତଥ୍ୟ ସହିତ ଡିଭାଇସ୍‌ରେ ମେଳ କରନ୍ତୁ'},
  'as-IN': {home:'মুখ্য পৃষ্ঠা',tools:'ফাইল সঁজুলি',details:'মোৰ তথ্য',assist:'ফৰ্ম সহায়',hero:'আপোনাৰ ভাষাত সহায়',headline:'কাগজ-পত্ৰৰ কাম, এতিয়া অলপ সহজ।',intro:'আপোনাৰ তথ্য এই ডিভাইচতে ৰাখক। চৰকাৰী ফৰ্মৰ বাবে ফটো আৰু PDF সাজু কৰক।',need:'আজি কিহত সহায় লাগে?',start:'আৰম্ভ কৰাৰ দুটা সহজ উপায়',toolCard:'ফটো বা PDF সৰু কৰক',toolDesc:'আকাৰ সলনি, ঘূৰাওক, জোৰক বা পৃথক কৰক',detailsCard:'মোৰ তথ্য সাঁচি ৰাখক',detailsDesc:'নথিৰ বাবে তথ্য ইয়াতে ৰাখক',assistCard:'ফৰ্ম পূৰণত সহায়',assistDesc:'লেবেল আৰু সাঁচি থোৱা তথ্য স্থানীয়ভাৱে মিলাওক'},
  'ur-IN': {home:'صفحۂ اول',tools:'فائل کے اوزار',details:'میری معلومات',assist:'فارم میں مدد',hero:'آپ کی زبان میں مدد',headline:'کاغذی کارروائی، اب کچھ آسان۔',intro:'اپنی معلومات اسی ڈیوائس پر رکھیں۔ سرکاری فارم کے لیے تصاویر اور PDF تیار کریں۔',need:'آج کس کام میں مدد چاہیے؟',start:'شروع کرنے کے دو آسان طریقے',toolCard:'تصویر یا PDF کا حجم کم کریں',toolDesc:'حجم بدلیں، گھمائیں، جوڑیں یا الگ کریں',detailsCard:'میری معلومات محفوظ کریں',detailsDesc:'دستاویزات کے لیے معلومات یہاں رکھیں',assistCard:'فارم بھرنے میں مدد',assistDesc:'لیبلز کو محفوظ معلومات سے اسی ڈیوائس پر ملائیں'},
  'en-IN': {home:'Home',tools:'File tools',details:'My details',assist:'Form help',hero:'HELP WITH THE PAPERWORK',headline:'Paperwork, made a little easier.',intro:'Keep your details on this device. Prepare photos and PDFs for the government forms you need.',need:'What do you need help with today?',start:'Two simple ways to start',toolCard:'Resize a photo or PDF',toolDesc:'Resize, rotate, join or split',detailsCard:'Save my details',detailsDesc:'Keep personal details on this device',assistCard:'Form assistance',assistDesc:'Match labels to saved details locally'},
};
const safeId = () => crypto.randomUUID();
const toBase64 = (bytes:Uint8Array) => {
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000) binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  return btoa(binary);
};
const fromBase64 = (value:string) => Uint8Array.from(atob(value),character=>character.charCodeAt(0));
const deriveEncryptionKey = async (password:string,salt:string) => {
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:fromBase64(salt),iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
};
const encryptValue = async (key:CryptoKey,value:string|ArrayBuffer|Uint8Array):Promise<Ciphertext> => {
  const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof ArrayBuffer?new Uint8Array(value):value;
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const input=bytes.slice().buffer as ArrayBuffer;
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,input);
  return {iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext))};
};
const decryptValue = async (key:CryptoKey,value:Ciphertext) =>
  new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(value.iv)},key,fromBase64(value.ciphertext)));
const loadScript = (src:string) => new Promise<void>((resolve,reject) => {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.ready === 'yes') { resolve(); return; }
  const script = existing || document.createElement('script');
  script.src = src;
  script.onload = () => { script.dataset.ready = 'yes'; resolve(); };
  script.onerror = () => reject(new Error('PDF processing library could not be loaded. Check your connection and try again.'));
  if (!existing) document.head.append(script);
});
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
function App() {
  const [location, setLocation] = useLocation();
  const [account,setAccount] = useState<Account|null>(null);
  const [hasLocalAccount,setHasLocalAccount] = useState(false);
  const [encryptionKey,setEncryptionKey] = useState<CryptoKey|null>(null);
  const [profile,setProfile] = useState<Profile>({});
  const [docs,setDocs] = useState<StoredDocument[]>([]);
  const [ui,setUi] = useState<'hi'|'en'>('hi');
  const [language,setLanguage] = useState('hi-IN');
  const [toast,setToast] = useState('');
  const [ready,setReady] = useState(false);
  const [authMode,setAuthMode] = useState<'login'|'register'>('login');
  const [settings,setSettings] = useState<ToolSettings>(defaultSettings);
  const [toolFiles,setToolFiles] = useState<File[]>([]);
  const [category,setCategory] = useState('other');
  const [processed,setProcessed] = useState<Processed|null>(null);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState('');
  const [selectedService,setSelectedService] = useState<FormService|null>(null);
  const [profileDirty,setProfileDirty] = useState(false);
  const [inputError,setInputError] = useState('');
  const [authError,setAuthError] = useState('');
  const isLogin = location === '/login';
  const routeHome = location === '/';
  const isProfile = location === '/profile';
  const isTools = location === '/tools';
  const isAssist = location === '/assist';
  const isDashboard = location === '/dashboard' || routeHome;
  const isHindi = language === 'hi-IN';
  const words = SHELL_COPY[language] || SHELL_COPY['en-IN'];

  const refreshDocs = async (key:CryptoKey|null=encryptionKey) => {
    if(!key){setDocs([]);return;}
    try {
      const encrypted=await dbAction<EncryptedDocument[]>('documents','readonly',s=>s.getAll());
      const decrypted=await Promise.all(encrypted.map(async doc=>({...doc,blob:new Blob([await decryptValue(key,doc)],{type:doc.mime})})));
      setDocs(decrypted.sort((a,b)=>b.createdAt-a.createdAt));
    } catch { setDocs([]);setToast('दस्तावेज़ खोल नहीं पाए। पासवर्ड से लॉगिन करके फिर कोशिश करें।'); }
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const savedAccount = await dbAction<(Account & {id:string})|undefined>('records','readonly',s=>s.get('account'));
        if (savedAccount) {
          if (!mounted) return;
          setHasLocalAccount(true);setAuthMode('login');setUi(savedAccount.ui || 'hi');setLanguage(savedAccount.language || 'hi-IN');
          if (location === '/') setLocation('/login');
        } else {setHasLocalAccount(false);setAuthMode('register');if (location === '/') setLocation('/login');}
      } catch { if (mounted) setToast('स्थानीय डेटा नहीं खुल पाया।'); }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(()=>{ if (!toast) return; const timer=window.setTimeout(()=>setToast(''),3800); return ()=>window.clearTimeout(timer); },[toast]);
  useEffect(()=>{ if (account) void dbAction('records','readwrite',s=>s.put({id:'settings',...settings})).catch(()=>{}); },[settings,account]);
  const inputPreview=useMemo(()=>toolFiles[0]?URL.createObjectURL(toolFiles[0]):'', [toolFiles]);
  const outputPreview=useMemo(()=>processed?URL.createObjectURL(processed.blob):'', [processed]);
  useEffect(()=>()=>{if(inputPreview)URL.revokeObjectURL(inputPreview);if(outputPreview)URL.revokeObjectURL(outputPreview);},[inputPreview,outputPreview]);

  const langChange = (code:string) => {
    setLanguage(code);
    if (account) {
      const next={...account,language:code}; setAccount(next); void dbAction('records','readwrite',s=>s.put({id:'account',...next})).catch(()=>setToast('भाषा सेव नहीं हुई।'));
    }
  };
  const saveProfile = async (next:Profile) => {
    if(!encryptionKey) return;
    setProfile(next);
    const encrypted=await encryptValue(encryptionKey,JSON.stringify(next));
    await dbAction('records','readwrite',s=>s.put({id:'profile',...encrypted}));
  };
  const speak = (_text:string) => setToast(isHindi?'आवाज़ सुविधा जल्द उपलब्ध होगी।':'Voice assistance will be available soon.');
  const listen = (_key:string) => setToast(isHindi?'माइक्रोफ़ोन सुविधा जल्द उपलब्ध होगी।':'Microphone assistance will be available soon.');
  const logIn = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthError('');
    const form=new FormData(event.currentTarget),email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||'');
    if (!email || password.length<6) { setAuthError('ईमेल और कम से कम 6 अक्षर का पासवर्ड भरें।'); return; }
    try {
      const saved=await dbAction<(Account & {id:string})|undefined>('records','readonly',s=>s.get('account'));
      if (authMode==='register' && saved) { setAuthError(saved.email===email?'इस ब्राउज़र में यह ईमेल पहले से मौजूद है। लॉगिन करें।':'इस ब्राउज़र में एक खाता पहले से है। पहले लॉगिन करें।'); return; }
      if (authMode==='login') {
        if (!saved) { setAuthError('इस ब्राउज़र में अभी कोई खाता नहीं है। पहले नया खाता बनाएँ।'); return; }
        const previous:Account=saved;
        if(previous.email!==email) { setAuthError('ईमेल या पासवर्ड सही नहीं है।'); return; }
        try {
          const key=await deriveEncryptionKey(password,previous.salt);
          const verifier=new TextDecoder().decode(await decryptValue(key,{iv:previous.authIv,ciphertext:previous.authVerifier}));
          if(verifier!=='sarkari-saathi-local-account-v1') throw new Error('Invalid password');
          const profileRecord=await dbAction<(Ciphertext & {id:string})|undefined>('records','readonly',s=>s.get('profile'));
          const profile=profileRecord?JSON.parse(new TextDecoder().decode(await decryptValue(key,profileRecord))):{};
          const encryptedDocs=await dbAction<EncryptedDocument[]>('documents','readonly',s=>s.getAll());
          const decryptedDocs=await Promise.all(encryptedDocs.map(async doc=>({...doc,blob:new Blob([await decryptValue(key,doc)],{type:doc.mime})})));
          const cfg=await dbAction<ToolSettings|undefined>('records','readonly',s=>s.get('settings'));
          setEncryptionKey(key);setAccount(previous);setHasLocalAccount(true);setLanguage(previous.language);setUi(previous.ui);setProfile(profile);setDocs(decryptedDocs.sort((a,b)=>b.createdAt-a.createdAt));setSettings(cfg||defaultSettings);setLocation('/dashboard');return;
        } catch { setAuthError('ईमेल या पासवर्ड सही नहीं है, या स्थानीय डेटा नहीं खुल पाया।'); return; }
      }
      const salt=toBase64(crypto.getRandomValues(new Uint8Array(16)));
      const key=await deriveEncryptionKey(password,salt);
      const verifier=await encryptValue(key,'sarkari-saathi-local-account-v1');
      const next:Account={email,salt,authIv:verifier.iv,authVerifier:verifier.ciphertext,language,ui};
      const encryptedProfile=await encryptValue(key,JSON.stringify({}));
      await dbAction('records','readwrite',s=>s.put({id:'account',...next})); await dbAction('records','readwrite',s=>s.put({id:'profile',...encryptedProfile}));
      setEncryptionKey(key);setAccount(next);setHasLocalAccount(true);setProfile({});setDocs([]);setUi(ui);setLocation('/dashboard');
    } catch { setAuthError('खाता इस डिवाइस पर सेव नहीं हो पाया।'); }
  };
  const signOut = () => { setAccount(null);setEncryptionKey(null);setProfile({});setDocs([]);setLocation('/login'); };
  const wipeData = async () => {
    if (!window.confirm('क्या आप इस ब्राउज़र से अपना खाता, जानकारी और सभी दस्तावेज़ हमेशा के लिए मिटाना चाहते हैं?')) return;
    try {
      await Promise.all([
        dbAction('documents','readwrite',s=>s.clear()),
        dbAction('records','readwrite',s=>s.clear()),
      ]);
      setAccount(null);setEncryptionKey(null);setHasLocalAccount(false);setProfile({});setDocs([]);setSettings(defaultSettings);setToolFiles([]);setProcessed(null);setAuthMode('register');setLocation('/login');setToast('इस ब्राउज़र का डेटा मिटा दिया गया।');
    } catch { setToast('डेटा पूरी तरह नहीं मिटा। फिर कोशिश करें।'); }
  };

  const checkSignature = async (file:File) => {
    if (file.size > 25*1024*1024) throw new Error('फ़ाइल 25 MB से बड़ी है। छोटी फ़ाइल चुनें।');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const pdf=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46;
    const jpg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
    const webp=bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
    if (!(pdf||jpg||png||webp)) throw new Error('फ़ाइल का प्रकार सही नहीं है या फ़ाइल खराब है। केवल वैध JPG, PNG, WEBP या PDF चुनें।');
    if ((pdf && file.type && file.type!=='application/pdf') || (!pdf && file.type==='application/pdf')) throw new Error('फ़ाइल का नाम और असली फ़ाइल प्रकार अलग हैं। सही फ़ाइल चुनें।');
    return pdf?'application/pdf':jpg?'image/jpeg':png?'image/png':'image/webp';
  };
  const onToolFiles = async (list:FileList|null) => {
    if (!list) return;
    setInputError('');setProcessed(null);
    try {
      const selected=Array.from(list);
      if (selected.length>5) throw new Error('एक बार में अधिकतम 5 फ़ाइलें चुनें।');
      for (const file of selected) await checkSignature(file);
      setToolFiles(selected);
    } catch (error) { setToolFiles([]);setInputError(error instanceof Error?error.message:'फ़ाइल नहीं खुली।'); }
  };
  const addVaultFiles = async (list:FileList|null) => {
    if (!list) return;
    setInputError('');
    for (const file of Array.from(list)) {
      try {
        const mime=await checkSignature(file);
        if(!encryptionKey) throw new Error('पहले लॉगिन करें।');
        const encrypted=await encryptValue(encryptionKey,await file.arrayBuffer());
        await dbAction('documents','readwrite',s=>s.put({id:safeId(),name:file.name,category,mime,size:file.size,createdAt:Date.now(),...encrypted}));
      } catch(error) { setInputError(error instanceof Error?error.message:'फ़ाइल सेव नहीं हुई।'); }
    }
    await refreshDocs();
  };
  const deleteDoc = async (id:string) => {
    if (!window.confirm('यह दस्तावेज़ इस डिवाइस से हटाएँ?')) return;
    await dbAction('documents','readwrite',s=>s.delete(id)); await refreshDocs();
  };

  const runTool = async () => {
    setInputError('');setProcessed(null);
    if (!toolFiles.length) { setInputError('पहले कोई फ़ाइल चुनें।'); return; }
    setBusy(true);
    try {
      const file=toolFiles[0],mime=await checkSignature(file);
      let blob:Blob,name=file.name.replace(/\.[^.]+$/,'');
      if (settings.operation==='pdf-compress' && mime!=='application/pdf') throw new Error('PDF छोटा करने के लिए PDF फ़ाइल चुनें।');
      if (settings.operation==='image-to-pdf') {
        if (mime==='application/pdf') throw new Error('Image to PDF के लिए पहले एक तस्वीर चुनें।');
        await loadScript(JSPDF); const J=(window as unknown as {jspdf:{jsPDF:new(options:unknown)=>any}}).jspdf.jsPDF;
        const bitmap=await createImageBitmap(file),doc=new J({unit:'pt',format:'a4',compress:true});
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')?.drawImage(bitmap,0,0);
        const data=canvas.toDataURL('image/jpeg',.9);const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),scale=Math.min(pw/bitmap.width,ph/bitmap.height);
        doc.addImage(data,'JPEG',(pw-bitmap.width*scale)/2,(ph-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);blob=doc.output('blob');name+='.pdf';
      } else if (mime==='application/pdf') {
        if(settings.operation==='image-to-pdf') throw new Error('तस्वीर से PDF बनाने के लिए तस्वीर चुनें।');
        if(!['compress','pdf-compress','pdf-merge','pdf-split','pdf-to-image'].includes(settings.operation)) throw new Error('इस काम के लिए तस्वीर चुनें, PDF नहीं।');
        if (settings.operation==='pdf-merge') {
          if(toolFiles.length<2) throw new Error('PDF merge के लिए कम से कम 2 PDF फ़ाइलें चुनें।');
          await loadScript(PDFLIB); const lib=(window as unknown as {PDFLib:any}).PDFLib;const merged=await lib.PDFDocument.create();
          for(const f of toolFiles){ if(await checkSignature(f)!=='application/pdf') throw new Error('Merge में केवल PDF फ़ाइलें चुनें।');const src=await lib.PDFDocument.load(await f.arrayBuffer());const pages=await merged.copyPages(src,src.getPageIndices());pages.forEach((p:any)=>merged.addPage(p)); }
          blob=new Blob([await merged.save({useObjectStreams:true})],{type:'application/pdf'});name='merged-document.pdf';
        } else if(settings.operation==='pdf-split') {
          await loadScript(PDFLIB); const lib=(window as unknown as {PDFLib:any}).PDFLib;const src=await lib.PDFDocument.load(await file.arrayBuffer());const indexes=settings.splitPages.split(',').flatMap(part=>{const [a,b]=part.trim().split('-').map(Number);return b?Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i-1):[a-1]}).filter((n:number)=>Number.isInteger(n)&&n>=0&&n<src.getPageCount());
          if(!indexes.length) throw new Error('पेज नंबर सही नहीं है। उदाहरण: 1 या 2-4');
          const out=await lib.PDFDocument.create(),pages=await out.copyPages(src,indexes);pages.forEach((p:any)=>out.addPage(p));blob=new Blob([await out.save()],{type:'application/pdf'});name='pages-'+settings.splitPages.replaceAll(',','_')+'.pdf';
        } else if(settings.operation==='pdf-to-image') {
          await loadScript(PDFJS);const pdfjs=(window as unknown as {pdfjsLib:any}).pdfjsLib;pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise, page=await pdf.getPage(1), vp=page.getViewport({scale:Math.min(2,settings.maxDimension/Math.max(page.view[2],page.view[3]))});
          const canvas=document.createElement('canvas');canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
          blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new Error('पेज की तस्वीर नहीं बनी।')),settings.outputType,.88));name+=settings.outputType==='image/png'?'.png':settings.outputType==='image/webp'?'.webp':'.jpg';
        } else {
          await loadScript(PDFJS);await loadScript(JSPDF);
          const pdfjs=(window as unknown as {pdfjsLib:any}).pdfjsLib;pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const J=(window as unknown as {jspdf:{jsPDF:new(options:unknown)=>any}}).jspdf.jsPDF;
          const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let out:Blob|null=null;
          for(let scale=1.5;scale>=.45;scale-=.2){
            const doc=new J({unit:'pt',format:'a4',compress:true});
            for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),vp=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('PDF पेज खोलने में समस्या हुई।');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport:vp}).promise;if(p>1)doc.addPage();const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),fit=Math.min(pw/canvas.width,ph/canvas.height);doc.addImage(canvas.toDataURL('image/jpeg',Math.max(.35,.8-(1.5-scale)*.45)),'JPEG',(pw-canvas.width*fit)/2,(ph-canvas.height*fit)/2,canvas.width*fit,canvas.height*fit);}
            const generated=doc.output('blob') as Blob;out=generated;if(generated.size<=settings.targetKB*1024)break;
          }
          if(!out)throw new Error('PDF आउटपुट नहीं बन पाया।');blob=out;name='compressed-'+name+'.pdf';
        }
      } else {
        if(settings.operation==='pdf-merge'||settings.operation==='pdf-split'||settings.operation==='pdf-to-image') throw new Error('इस काम के लिए PDF फ़ाइल चुनें।');
        const bitmap=await createImageBitmap(file);
        const max=settings.maxDimension>0?settings.maxDimension:Math.max(bitmap.width,bitmap.height);
        const baseWidth=Math.round(Math.min(bitmap.width,max)),baseHeight=Math.round(bitmap.height*(baseWidth/bitmap.width));
        const rotated=settings.rotation%180!==0,canvas=document.createElement('canvas');canvas.width=rotated?baseHeight:baseWidth;canvas.height=rotated?baseWidth:baseHeight;
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('तस्वीर पर काम नहीं हो पाया।');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(settings.rotation*Math.PI/180);ctx.drawImage(bitmap,-baseWidth/2,-baseHeight/2,baseWidth,baseHeight);
        const type=settings.outputType;
        let quality=.9,output:Blob|null=null;
        for(let cycle=0;cycle<10;cycle++){
          output=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));
          if(!output)throw new Error('इस फ़ाइल को चुने हुए प्रकार में बदल नहीं पाए।');
          if(output.type!==type)throw new Error('यह ब्राउज़र चुने हुए फ़ाइल प्रकार में आउटपुट नहीं बना सकता। दूसरा प्रकार चुनें।');
          if(settings.operation!=='compress'||output.size<=settings.targetKB*1024)break;
          if(quality>.42)quality-=.12;else { const scaled=document.createElement('canvas'),scale=.82;scaled.width=Math.max(1,Math.round(canvas.width*scale));scaled.height=Math.max(1,Math.round(canvas.height*scale));scaled.getContext('2d')?.drawImage(canvas,0,0,scaled.width,scaled.height);canvas.width=scaled.width;canvas.height=scaled.height;canvas.getContext('2d')?.drawImage(scaled,0,0);quality=.55; }
        }
        if(!output)throw new Error('तस्वीर नहीं बनी।');blob=output;const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';name=`${name}.${ext}`;
      }
      const reached=blob.size<=settings.targetKB*1024;
      const message=settings.operation==='compress'||settings.operation==='pdf-compress'
        ? reached?`लक्ष्य पूरा हुआ: ${bytesLabel(blob.size)}`
          : `काम पूरा हुआ, लेकिन ${settings.targetKB} KB का लक्ष्य नहीं मिला। अभी ${bytesLabel(blob.size)} है।`
        : `${settings.operation==='pdf-split'?'चुने हुए पेज':settings.operation==='pdf-to-image'?'पहला PDF पेज':'नई फ़ाइल'} तैयार है।`;
      setProcessed({blob,name,before:toolFiles.reduce((total,f)=>total+f.size,0),after:blob.size,message,type:blob.type});
    } catch(error) { setInputError(error instanceof Error?error.message:'फ़ाइल पर काम नहीं हो पाया।'); }
    finally { setBusy(false); }
  };
  const download = () => {
    if(!processed)return;const url=URL.createObjectURL(processed.blob),a=document.createElement('a');a.href=url;a.download=processed.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const navLinks = [
    {href:'/dashboard',label:words.home,icon:<Home size={19}/>},
    {href:'/tools',label:words.tools,icon:<FileImage size={19}/>},
    {href:'/profile',label:words.details,icon:<UserRound size={19}/>},
    {href:'/assist',label:words.assist,icon:<ClipboardList size={19}/>},
  ];
  const Header = () => <header className="topbar">
    <Link href="/dashboard" className="brand"><span className="brand-mark">स</span><span className="brand-word">सरकारी साथी<span className="brand-sub">SARKARI SAATHI</span></span></Link>
    {account&&<nav className="desktop-nav" aria-label="मुख्य मेनू">{navLinks.map(item=><Link href={item.href} key={item.href} className={`desktop-nav-link ${location===item.href||location==='/'&&item.href==='/dashboard'?'active':''}`}>{item.icon}<span>{item.label}</span></Link>)}</nav>}
    <div className="header-actions">
      <label className="sr-only" htmlFor="language-select">भाषा / Language</label>
      <select id="language-select" className="lang-select" value={language} onChange={e=>langChange(e.target.value)} aria-label="भाषा चुनें / Select language">
        {LANGUAGES.map(l=><option value={l.code} key={l.code}>{l.name} · {l.english}</option>)}
      </select>
      {account && <button className="button button-outline button-small language-toggle" aria-label={language==='hi-IN'?'Switch to English':'हिंदी में बदलें'} onClick={()=>langChange(language==='hi-IN'?'en-IN':'hi-IN')}>{language==='hi-IN'?'EN':'हिं'}</button>}
    </div>
  </header>;
  const BottomNav = () => <nav className="bottom-nav" aria-label="मुख्य मेनू">{navLinks.map(item=><Link href={item.href} key={item.href} className={`nav-link ${location===item.href||location==='/'&&item.href==='/dashboard'?'active':''}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>)}</nav>;
  const PageHeading = ({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode})=><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action&&<div className="heading-action">{action}</div>}</div>;
  const FeatureArt = () => <div className="hero-art" aria-hidden="true"><svg viewBox="0 0 390 292" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="245" cy="159" r="122" fill="#E7A878" opacity=".93"/><circle cx="245" cy="159" r="92" fill="#F6D0A4"/><path d="M185 97h111a16 16 0 0 1 16 16v145H169V113a16 16 0 0 1 16-16Z" fill="#FCF7E9"/><path d="M186 121h87M186 141h87M186 161h56M186 191h87M186 211h61" stroke="#91A69A" strokeWidth="5" strokeLinecap="round"/><path d="m269 188 17 18 37-43" stroke="#17694F" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/><path d="M113 231c17-21 36-33 58-37M318 75c13 7 24 18 31 31" stroke="#F6D0A4" strokeWidth="5" strokeLinecap="round"/></svg></div>;
  const Dashboard = () => {
    const visible=FORMS.filter(f=>`${f.en} ${f.hi}`.toLowerCase().includes(search.toLowerCase()));
    return <main className="shell">
      <section className="hero-panel"><div className="hero-copy"><div className="eyebrow">{words.hero}</div><h2>{words.headline}</h2><p>{words.intro}</p><Link href="/profile" className="button button-primary">{words.details}<ArrowRight size={16}/></Link></div><FeatureArt/></section>
      <div className="section-title"><h2>{words.need}</h2><span className="subtle">{words.start}</span></div>
      <section className="action-grid">
        <Link href="/tools" className="action-card"><span className="action-icon"><FileImage size={21}/></span><strong>{words.toolCard}</strong><span>{words.toolDesc}</span></Link>
        <Link href="/profile" className="action-card"><span className="action-icon"><UserRound size={21}/></span><strong>{words.detailsCard}</strong><span>{words.detailsDesc}</span></Link>
        <Link href="/assist" className="action-card"><span className="action-icon"><ClipboardList size={21}/></span><strong>{words.assistCard}</strong><span>{words.assistDesc}</span></Link>
      </section>
      <div className="privacy-note"><ShieldCheck size={20} strokeWidth={1.8}/><span><strong>{isHindi?'आपकी जानकारी यहीं रहती है।':'Your information stays here.'}</strong><br/>{isHindi?'यह शुरुआती डेमो इसी ब्राउज़र में चलता है। कोई सर्वर सिंक या AI सुविधा नहीं है।':'This first build works in this browser only. There is no server sync or AI feature.'}</span></div>
      <section className="services-section">
        <div className="section-title"><div><h2>{isHindi?'काम के रास्ते':'Common services'}</h2><small>{isHindi?'ये जानकारी जाँचने के लिए शुरुआती मदद है।':'A starting point only. Please verify requirements.'}</small></div></div>
        <label className="field" style={{display:'block',maxWidth:460,marginBottom:15}}><span className="sr-only">सेवा खोजें</span><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder={isHindi?'सेवा खोजें… जैसे छात्रवृत्ति':'Search services… try scholarship'} /></label>
        {visible.length===0?<div className="empty-state"><FileText size={24}/><strong>{isHindi?'इस नाम से कोई सेवा नहीं मिली':'No service matched that search'}</strong><span>{isHindi?'अलग शब्द लिखकर खोजें।':'Try a different word.'}</span></div>:<div className="action-grid">{visible.slice(0,6).map(service=><button key={service.id} className="action-card" onClick={()=>setSelectedService(service)} style={{textAlign:'left',borderStyle:'solid',font:'inherit'}}><span className="action-icon"><FileText size={20}/></span><strong>{isHindi?service.hi:service.en}</strong><span>{service.online?(isHindi?'ऑनलाइन सेवा':'Online service'):(isHindi?'ऑफ़िस जाकर':'In person')} · {isHindi?'दस्तावेज़ और कदम':'Documents & steps'}</span></button>)}</div>}
        <div className="status-message">{isHindi?'यह सेवा जानकारी सत्यापित नहीं है। भरोसा करने से पहले आधिकारिक वेबसाइट पर जाँचें।':'Service information is unverified. Check the official site before you rely on it.'}</div>
      </section>
      {selectedService && <div role="dialog" aria-modal="true" aria-label={isHindi?selectedService.hi:selectedService.en} className="service-modal" onClick={e=>{if(e.target===e.currentTarget)setSelectedService(null)}}><div className="service-sheet"><button className="modal-close" onClick={()=>setSelectedService(null)} aria-label="बंद करें">×</button><span className="eyebrow">{selectedService.online?(isHindi?'ऑनलाइन':'ONLINE'):(isHindi?'ऑफ़िस जाकर':'IN PERSON')}</span><h2>{isHindi?selectedService.hi:selectedService.en}</h2><div className="status-message">{isHindi?'यह जानकारी सत्यापित नहीं है। आधिकारिक साइट पर नियम और दस्तावेज़ जाँचें।':'This information is unverified. Check requirements on the official site.'}</div><h3>{isHindi?'ज़रूरी दस्तावेज़':'Documents needed'}</h3><ul className="service-docs">{selectedService.docs.map(id=><li key={id}><span className={`doc-check ${docs.some(d=>d.category===id)?'has':''}`}>{docs.some(d=>d.category===id)?<Check size={14}/>:null}</span>{isHindi?categories.find(c=>c.id===id)?.hi:categories.find(c=>c.id===id)?.en}</li>)}</ul><h3>{isHindi?'कदम-दर-कदम रास्ता':'Step-by-step roadmap'}</h3><ol className="service-steps">{(isHindi?selectedService.shi:selectedService.sen).map(step=><li key={step}>{step}</li>)}</ol><div className="row"><button className="button button-outline" onClick={()=>speak(`${isHindi?selectedService.hi:selectedService.en}. ${isHindi?'ज़रूरी दस्तावेज़':'Documents needed'}: ${selectedService.docs.map(id=>isHindi?categories.find(c=>c.id===id)?.hi:categories.find(c=>c.id===id)?.en).join(', ')}. ${isHindi?selectedService.shi.join(' '):selectedService.sen.join(' ')}`)}><Volume2 size={16}/>{isHindi?'सुनें':'Listen'}</button><a className="button button-primary" href={selectedService.url} target="_blank" rel="noreferrer">{isHindi?'आधिकारिक वेबसाइट खोलें':'Open official website'}<ArrowRight size={16}/></a></div></div></div>}
    </main>;
  };
  const Profile = () => {
    const setField=(key:string,value:string) => {const next={...profile,[key]:value};setProfile(next);setProfileDirty(true);};
    const save=async()=>{try{if(!encryptionKey)throw new Error('लॉगिन फिर से करें।');const encrypted=await encryptValue(encryptionKey,JSON.stringify(profile));await dbAction('records','readwrite',s=>s.put({id:'profile',...encrypted}));setProfileDirty(false);setToast(isHindi?'जानकारी एन्क्रिप्ट करके इस डिवाइस पर सेव हो गई।':'Details encrypted and saved on this device.');}catch{setToast('सेव नहीं हुआ। फिर कोशिश करें।');}};
    const onState=(state:string)=>{setField('state',state);const mapped=STATES.find(s=>s[0]===state)?.[1];if(mapped)langChange(mapped);};
    return <main className="shell"><PageHeading eyebrow={isHindi?'मेरी जानकारी':'MY DETAILS'} title={isHindi?'मेरी जानकारी':'My details'} description={isHindi?'बड़े अक्षरों में भरें। आपकी जानकारी इसी ब्राउज़र में सेव होगी।':'Fill in what you know. Details are saved only in this browser.'} action={<button className="button button-outline" onClick={()=>speak(isHindi?'मेरी जानकारी। हर खाने में अपनी जानकारी भरें। माइक्रोफ़ोन बटन से बोलकर भी भर सकते हैं।':'My details. Fill each field. Use the microphone button to speak a value.')}><Volume2 size={17}/>{isHindi?'सुनें':'Listen'}</button>}/><div className="surface"><div className="field-grid">{PROFILE_FIELDS.map(field=><div className="field" key={field.key}><label htmlFor={`profile-${field.key}`}>{isHindi?field.hi:field.en}</label><div className="input-wrap">{field.multiline?<textarea id={`profile-${field.key}`} className="textarea" value={profile[field.key]||''} onChange={e=>setField(field.key,e.target.value)} placeholder={isHindi?field.hi:field.en}/>:field.options?<select id={`profile-${field.key}`} className="select" value={profile[field.key]||''} onChange={e=>field.key==='state'?onState(e.target.value):setField(field.key,e.target.value)}><option value="">{isHindi?'चुनें':'Choose'}</option>{field.options.map(option=><option key={option} value={option}>{option}</option>)}</select>:<input id={`profile-${field.key}`} className="input" type={field.type||'text'} value={profile[field.key]||''} onChange={e=>setField(field.key,e.target.value)} placeholder={isHindi?field.hi:field.en} autoComplete="off"/>}<button className="mic-button" aria-label={`${isHindi?field.hi:field.en} बोलकर भरें`} onClick={()=>listen(field.key)} title={isHindi?'बोलकर भरें':'Speak to fill'}><Mic size={18}/></button></div>{field.key==='state'&&<p className="field-help">{isHindi?'राज्य चुनने पर भाषा अपने-आप चुने हुए राज्य के अनुसार होगी।':'Choosing a state updates the default language.'}</p>}</div>)}</div><div className="profile-actions"><button className="button button-outline" onClick={signOut}><ArrowLeft size={16}/>{isHindi?'लॉग आउट':'Log out'}</button><button className="button button-primary" onClick={save}><Check size={17}/>{isHindi?'जानकारी सेव करें':'Save details'}</button></div>{profileDirty&&<div className="status-message">{isHindi?'आपके बदलाव अभी सेव नहीं हुए हैं।':'Your changes have not been saved yet.'}</div>}</div><section className="surface danger-zone" style={{marginTop:18}}><div className="section-title" style={{marginTop:0}}><h2>{isHindi?'इस डिवाइस का डेटा':'Data on this device'}</h2><LockKeyhole size={20}/></div><p className="subtle">{isHindi?'यह डेमो स्थानीय है। खाता, प्रोफ़ाइल और दस्तावेज़ इसी ब्राउज़र में रखे जाते हैं।':'This demo is local to this browser. Account, profile and files are stored here only.'}</p><button className="button button-danger" onClick={wipeData}><Trash2 size={17}/>{isHindi?'मेरा सारा डेटा मिटाएँ':'Delete all my data'}</button></section></main>;
  };
  const Tools = () => {
    const opOptions=[['compress','तस्वीर छोटा करें','Compress image'],['resize','साइज़ बदलें','Resize image'],['convert','प्रकार बदलें','Convert image'],['rotate','घुमाएँ','Rotate image'],['pdf-compress','PDF छोटा करें','Compress PDF'],['pdf-merge','PDF जोड़ें','Merge PDFs'],['pdf-split','PDF पेज अलग करें','Split PDF pages'],['image-to-pdf','तस्वीर से PDF','Image to PDF'],['pdf-to-image','PDF पेज की तस्वीर','PDF page to image']];
    const pdfMode=settings.operation.startsWith('pdf-')||settings.operation==='pdf-to-image';
    const multi=settings.operation==='pdf-merge';
    const accept=multi?'.pdf,application/pdf':settings.operation==='image-to-pdf'?'image/jpeg,image/png,image/webp':pdfMode?'.pdf,application/pdf':'image/jpeg,image/png,image/webp';
    const addFiles=(e:ChangeEvent<HTMLInputElement>)=>{void onToolFiles(e.target.files);e.target.value='';};
    const updateSetting=(key:keyof ToolSettings,value:string|number)=>setSettings(prev=>({...prev,[key]:value}));
    return <main className="shell"><PageHeading eyebrow={isHindi?'फ़ाइल के औज़ार':'FILE TOOLS'} title={isHindi?'फ़ोटो और PDF तैयार करें':'Prepare a photo or PDF'} description={isHindi?'फ़ाइल आपके डिवाइस से बाहर नहीं जाती। साइज़ का लक्ष्य न मिले तो हम साफ़ बताएँगे।':'Files stay on your device. If a size target is missed, we will say so clearly.'} action={<div className="subtle"><ShieldCheck size={16} style={{verticalAlign:'middle',marginRight:5}}/>{isHindi?'केवल इसी डिवाइस पर':'On this device only'}</div>}/><div className="tool-tabs" role="tablist" aria-label="फ़ाइल टूल चुनें">{opOptions.map(([id,hi,en])=><button role="tab" aria-selected={settings.operation===id} key={id} className={`tool-tab ${settings.operation===id?'active':''}`} onClick={()=>{updateSetting('operation',id);setProcessed(null);setInputError('')}}>{isHindi?hi:en}</button>)}</div>
      <section className="surface">
        <label className="upload-zone" htmlFor="tool-file"><Upload size={22} color="#17694f"/><strong>{toolFiles.length?`${toolFiles.length} ${isHindi?'फ़ाइल चुनी':'file(s) selected'}`:isHindi?'यहाँ फ़ाइल चुनें':'Choose a file'}</strong><p>{multi?(isHindi?'2 से 5 PDF चुनें':'Choose 2 to 5 PDF files'):(isHindi?'JPG, PNG, WEBP या PDF · अधिकतम 25 MB':'JPG, PNG, WEBP or PDF · 25 MB max')}</p><span className="button button-outline button-small"><FolderOpen size={15}/>{isHindi?'फ़ाइलें देखें':'Browse files'}</span><input id="tool-file" type="file" hidden multiple={multi} accept={accept} onChange={addFiles}/></label>
        {toolFiles.length>0&&<div className="file-list">{toolFiles.map(file=><div className="file-row" key={`${file.name}-${file.size}`}><span className="action-icon"><FileText size={18}/></span><div className="file-meta"><strong>{file.name}</strong><span>{bytesLabel(file.size)} · {file.type||'file'}</span></div><button className="icon-only" onClick={()=>{setToolFiles(files=>files.filter(f=>f!==file));setProcessed(null)}} aria-label="फ़ाइल हटाएँ"><Trash2 size={17}/></button></div>)}</div>}
        <div className="settings-grid">
          {(settings.operation==='compress'||settings.operation==='pdf-compress')&&<div className="field"><label htmlFor="target-kb">{isHindi?'अधिकतम साइज़ (KB)':'Target size (KB)'}</label><input id="target-kb" type="number" min="1" className="input" value={settings.targetKB} onChange={e=>updateSetting('targetKB',Math.max(1,Number(e.target.value)))}/><p className="field-help">{isHindi?'यह आपकी चुनी हुई सीमा है, हर फ़ाइल के लिए संभव नहीं।':'This is your requested limit; not every file can reach it.'}</p></div>}
          {(['compress','resize','convert','rotate'].includes(settings.operation)&&toolFiles[0]?.type!=='application/pdf'||settings.operation==='pdf-to-image')&&<div className="field"><label htmlFor="max-dimension">{isHindi?'अधिकतम चौड़ाई / ऊँचाई (px)':'Maximum width / height (px)'}</label><input id="max-dimension" className="input" type="number" min="1" value={settings.maxDimension} onChange={e=>updateSetting('maxDimension',Math.max(1,Number(e.target.value)))}/></div>}
          {['convert','pdf-to-image'].includes(settings.operation)&&<div className="field"><label htmlFor="output-type">{isHindi?'आउटपुट प्रकार':'Output type'}</label><select id="output-type" className="select" value={settings.outputType} onChange={e=>updateSetting('outputType',e.target.value)}><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WEBP</option></select></div>}
          {['rotate','compress','resize','convert'].includes(settings.operation)&&toolFiles[0]?.type!=='application/pdf'&&<div className="field"><label htmlFor="rotate">{isHindi?'घुमाव':'Rotation'}</label><select id="rotate" className="select" value={settings.rotation} onChange={e=>updateSetting('rotation',Number(e.target.value))}><option value="0">{isHindi?'घुमाएँ नहीं':'No rotation'}</option><option value="90">{isHindi?'90° दायाँ':'90° clockwise'}</option><option value="180">{isHindi?'180°':'180°'}</option><option value="270">{isHindi?'90° बायाँ':'90° counter-clockwise'}</option></select></div>}
          {settings.operation==='pdf-split'&&<div className="field"><label htmlFor="split-pages">{isHindi?'पेज नंबर (जैसे 1 या 2-4)':'Page numbers (for example 1 or 2-4)'}</label><input id="split-pages" className="input" value={settings.splitPages} onChange={e=>updateSetting('splitPages',e.target.value)}/></div>}
          {settings.operation==='pdf-merge'&&<div className="field-help">{isHindi?'फ़ाइलें चुने गए क्रम में जोड़ी जाएँगी।':'Files will be merged in the selected order.'}</div>}
        </div>
        {inputError&&<div className="status-message error" role="alert">{inputError}</div>}
        <div className="profile-actions" style={{borderTop:0,paddingTop:0}}><span className="subtle">{isHindi?'आपकी फ़ाइलें सर्वर पर नहीं भेजी जातीं।':'Your files are not sent to a server.'}</span><button className="button button-primary" disabled={busy} onClick={()=>void runTool()}>{busy?<span className="loading-skeleton" style={{width:80}}/>:<><WandSparkles size={17}/>{isHindi?'फ़ाइल तैयार करें':'Process file'}</>}</button></div>
        {processed&&<div className="result-panel" aria-live="polite"><div><h3>{isHindi?'पहले':'Before'}</h3><div className="preview-box">{toolFiles[0]?.type.startsWith('image/')?<img src={inputPreview} alt="मूल फ़ाइल का पूर्वावलोकन"/>:toolFiles[0]?.type==='application/pdf'?<iframe title="मूल PDF पूर्वावलोकन" src={inputPreview}/>:<FileText size={34}/>}</div><p className="subtle" style={{margin:'9px 0 0'}}>{bytesLabel(processed.before)}</p></div><div><h3>{isHindi?'तैयार फ़ाइल':'Ready file'}</h3><div className="preview-box">{processed.type.startsWith('image/')?<img src={outputPreview} alt="तैयार फ़ाइल का पूर्वावलोकन"/>:processed.type==='application/pdf'?<iframe title="तैयार PDF पूर्वावलोकन" src={outputPreview}/>:<FileText size={34}/>}</div><p className="subtle" style={{margin:'9px 0 8px'}}>{bytesLabel(processed.after)} · {processed.name}</p><button className="button button-primary button-small" onClick={download}><ArrowDownToLine size={16}/>{isHindi?'डाउनलोड करें':'Download file'}</button></div><div className={`status-message ${(settings.operation==='compress'||settings.operation==='pdf-compress')&&processed.after>settings.targetKB*1024?'error':''}`} style={{gridColumn:'1 / -1',margin:0}}>{processed.message}</div></div>}
      </section>
      <section className="surface" style={{marginTop:18}}><div className="section-title" style={{marginTop:0}}><h2>{isHindi?'मेरे दस्तावेज़':'My documents'}</h2><span className="subtle">{docs.length} {isHindi?'फ़ाइलें':'files'}</span></div><div className="document-categories">{categories.map(cat=><div className="category-option" key={cat.id}><span className="category-dot"/><span>{isHindi?cat.hi:cat.en}</span><strong style={{marginLeft:'auto',fontSize:12}}>{docs.filter(d=>d.category===cat.id).length}</strong></div>)}</div><div className="field-grid" style={{marginTop:17}}><div className="field"><label htmlFor="document-category">{isHindi?'दस्तावेज़ का प्रकार':'Document category'}</label><select id="document-category" className="select" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(cat=><option value={cat.id} key={cat.id}>{isHindi?cat.hi:cat.en}</option>)}</select></div><div className="field"><label htmlFor="vault-upload">{isHindi?'दस्तावेज़ जोड़ें':'Add a document'}</label><label className="button button-outline" htmlFor="vault-upload" style={{width:'100%'}}><FilePlus2 size={17}/>{isHindi?'फ़ोन / डिवाइस से चुनें':'Choose from device'}<input id="vault-upload" type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{void addVaultFiles(e.target.files);e.target.value=''}}/></label></div></div>{docs.length===0?<div className="empty-state"><FolderOpen size={24}/><strong>{isHindi?'अभी कोई दस्तावेज़ सेव नहीं है':'No saved documents yet'}</strong><span>{isHindi?'यहाँ जोड़ें—फ़ाइलें सिर्फ़ इसी डिवाइस पर रहेंगी।':'Add a file here. It stays on this device only.'}</span></div>:<div className="file-list">{docs.map(doc=><div className="file-row" key={doc.id}><span className="action-icon">{doc.mime==='application/pdf'?<FileText size={18}/>:<FileImage size={18}/>}</span><div className="file-meta"><strong>{doc.name}</strong><span>{isHindi?categories.find(c=>c.id===doc.category)?.hi:categories.find(c=>c.id===doc.category)?.en} · {bytesLabel(doc.size)}</span></div><button className="button button-outline button-small" onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(doc.blob);a.download=doc.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}><ArrowDownToLine size={15}/>{isHindi?'डाउनलोड':'Download'}</button><button className="icon-only" onClick={()=>void deleteDoc(doc.id)} aria-label={`${doc.name} हटाएँ`}><Trash2 size={17}/></button></div>)}</div>}{inputError&&<div className="status-message error" role="alert">{inputError}</div>}</section>
    </main>;
  };
  const Login = () => <div className="auth-layout"><section className="auth-story"><div className="story-mark">स</div><div className="eyebrow">{isHindi?'सरल मदद, आपकी भाषा में':'PAPERWORK, MADE PLAIN'}</div><h1>{isHindi?'सरकारी काम के लिए एक अपना साथी।':'A familiar guide for official paperwork.'}</h1><p>{isHindi?'अपनी जानकारी सुरक्षित रखें। फ़ोटो और PDF तैयार करें। शुरुआत इसी डिवाइस से करें।':'Keep your details close. Prepare a photo or PDF. Start right here on this device.'}</p><p className="brand-line">{isHindi?'हिंदी पहले · साफ़ भाषा · आपकी फ़ाइलें आपके पास':'Hindi first · Plain words · Your files stay with you'}</p></section><section className="auth-card"><h2>{authMode==='login'?(isHindi?'वापस आइए':'Welcome back'):(isHindi?'नया खाता बनाएँ':'Create a local account')}</h2><p>{hasLocalAccount?(isHindi?'इस ब्राउज़र में अपना खाता खोलें।':'Sign in to the account saved in this browser.'):(isHindi?'यह खाता सिर्फ़ इस ब्राउज़र में सेव होगा।':'Your demo account is saved in this browser only.')}</p><form className="auth-fields" onSubmit={e=>void logIn(e)}><div><label htmlFor="auth-email">{isHindi?'ईमेल':'Email'}</label><input id="auth-email" name="email" className="input" type="email" autoComplete="email" required placeholder="name@example.com"/></div><div><label htmlFor="auth-password">{isHindi?'पासवर्ड':'Password'}</label><input id="auth-password" name="password" className="input" type="password" autoComplete={authMode==='login'?'current-password':'new-password'} minLength={6} required placeholder={isHindi?'कम से कम 6 अक्षर':'At least 6 characters'}/></div>{authError&&<div className="status-message error" role="alert">{authError}</div>}<button className="button button-primary" type="submit">{authMode==='login'?(isHindi?'लॉगिन करें':'Log in'):(isHindi?'खाता बनाएँ':'Create account')}<ArrowRight size={17}/></button></form><button className="text-link" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?(isHindi?'पहली बार आए हैं? नया खाता बनाएँ':'New here? Create an account'):(isHindi?'पहले से खाता है? लॉगिन करें':'Already have an account? Log in')}</button><div className="privacy-note"><LockKeyhole size={18}/><span>{isHindi?'प्रोफ़ाइल और फ़ाइलें आपके पासवर्ड से एन्क्रिप्ट होकर इसी ब्राउज़र में रहती हैं। पासवर्ड भूलने पर इन्हें वापस नहीं पाया जा सकता।':'Your profile and files are encrypted with your password in this browser. They cannot be recovered if you forget it.'}</span></div></section></div>;

  if (!ready) return <div className="app-frame"><Header/><main className="shell"><div className="loading-skeleton" style={{width:180,height:26,marginBottom:18}}/><div className="loading-skeleton" style={{height:235,borderRadius:25}}/></main></div>;
  if (!account && !isLogin) return <div className="app-frame"><Header/>{Login()}</div>;
  return <div className="app-frame"><Header/>{isLogin&&!account?Login():isDashboard?Dashboard():isTools?Tools():isProfile?Profile():isAssist?<FormAssistance profile={profile} language={language} onSpeak={speak} onBack={()=>setLocation('/dashboard')}/>:Dashboard()}{account&&<BottomNav/>}{toast&&<div className="toast" role="status">{toast}</div>}</div>;
}

export default App;
