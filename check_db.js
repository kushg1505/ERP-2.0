const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "dummy",
  authDomain: "class-schedule-bdf63.firebaseapp.com",
  projectId: "class-schedule-bdf63",
  storageBucket: "class-schedule-bdf63.firebasestorage.app",
  messagingSenderId: "148679469550",
  appId: "1:148679469550:web:48dc8ab4f99dd955406087",
  measurementId: "G-G6Q3ZZV2F4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDB() {
  const docRef = doc(db, "master_schedules_1st-core", "week-1-term-2");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const classes = docSnap.data().classes || [];
    const dtiClasses = classes.filter(c => c.courseAbb === 'DTI');
    console.log("Found", dtiClasses.length, "DTI classes in DB.");
    if (dtiClasses.length > 0) {
      console.log("First DTI class:", dtiClasses[0]);
    }
  } else {
    console.log("No document found!");
  }
}
checkDB();
