import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDsCdy3SBAF5FEEmPm6UuR7M2Y56wzZMnQ",
  authDomain: "mba-scheduling.firebaseapp.com",
  projectId: "mba-scheduling",
  storageBucket: "mba-scheduling.firebasestorage.app",
  messagingSenderId: "909236588925",
  appId: "1:909236588925:web:bf3f94ed126c093ec37c14"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipeOldData() {
  console.log("Starting wipe...");
  
  // Wipe old master_schedules (keep term-5)
  const masterSnap = await getDocs(collection(db, "master_schedules"));
  for (const d of masterSnap.docs) {
    if (!d.id.includes("term-5")) {
      await deleteDoc(doc(db, "master_schedules", d.id));
      console.log("Deleted old schedule:", d.id);
    }
  }

  // Wipe old clashes entirely
  const clashSnap = await getDocs(collection(db, "clashes"));
  for (const d of clashSnap.docs) {
    await deleteDoc(doc(db, "clashes", d.id));
    console.log("Deleted old clash:", d.id);
  }

  // Wipe old users (actually let's not wipe users completely to not log them out, just leave it as they will overwrite it via Profile)
  console.log("Wipe complete.");
  process.exit(0);
}

wipeOldData();
