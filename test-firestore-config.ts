import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const app = initializeApp({projectId: "reviseai-7b8ae"});
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
console.log(db.type);
