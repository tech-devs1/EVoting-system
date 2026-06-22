import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLZAnrMZJhti55Mo3PTntoPFa4-8hvHb4",
  authDomain: "voting-0.firebaseapp.com",
  projectId: "voting-0",
  storageBucket: "voting-0.firebasestorage.app",
  messagingSenderId: "719858248032",
  appId: "1:719858248032:web:06f6fd64c8f29639cc5605",
  measurementId: "G-PP0ZC2Q44R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const studentsRaw = `ADDAE BISMARK KOFI | 0324080252 | 0324080252@htu.edu.gh
ADEKPLORVI PETER CYRIL | 324080176 | 324080176@htu.edu.gh
ADJEI BEDIAKO MANFRED | 0324080408 | 0324080408@htu.edu.gh
ADU THEOPHILUS | 0324080209 | 0324080209@htu.edu.gh
AFESE PROSPER KEKELI | 0324080282 | 0324080282@htu.edu.gh
AGADZI HARRISON | 0324080423 | 0324080423@htu.edu.gh
AGBETI JOHN JUNIOR | 0324080345 | 0324080345@htu.edu.gh
AGBINKU WISDOM | 0324080351 | 0324080351@htu.edu.gh
AGBOZO JOEL AGBENYEGA KOBLA | 0324080688 | 0324080688@htu.edu.gh
AHAMEY ANTHONY | 0324080361 | 0324080361@htu.edu.gh
AHUBLEY PATMOS | 0324080044 | 0324080044@htu.edu.gh
AKORLI NATHANIEL ENAM | 0324080458 | 0324080458@htu.edu.gh
AKOTO YEREMIAH KWAKU MENSAH | 0324080577 | 0324080577@htu.edu.gh
AKPOSOE FRED | 0324080620 | 0324080620@htu.edu.gh
AKUKLU CONFIDENCE | 0324080114 | 0324080114@htu.edu.gh
AMEKUDZI THEOPHILUS | 0324080131 | 0324080131@htu.edu.gh
AMEVEGBE HENRY ELINAM YAO | 0324080649 | 0324080649@htu.edu.gh
AMOAH JOSEPH YAW | 0324080674 | 0324080674@htu.edu.gh
AMPIAW KEVIN | 0324080446 | 0324080446@htu.edu.gh
ANYALEWECHI CHUKWUEBUKA | 0324080636 | 0324080636@htu.edu.gh
ARTHUR ELIZABETH POKUA | 0324080433 | 0324080433@htu.edu.gh
ASAMENU WISDOM EYRAM KWAKU | 0324080302 | 0324080302@htu.edu.gh
ASANTE ISAAC | 0324080024 | 0324080024@htu.edu.gh
ATTAH ISRAEL AFENYO | 0324080016 | 0324080016@htu.edu.gh
AZIEBU MAWUNYEFIA | 0324080310 | 0324080310@htu.edu.gh
AZUMAH ABRAHAM | 0324080523 | 0324080523@htu.edu.gh
BASHMAN MARCUS GARVEY | 0324080312 | 0324080312@htu.edu.gh
BEMPONG FRANK ADU | 0324080678 | 0324080678@htu.edu.gh
BENEDICTA BORLEY BORKETEY | 0324080324 | 0324080324@htu.edu.gh
BERTHA NAA DZAMA AYI | 0324080457 | 0324080457@htu.edu.gh
BUMEGBE WISDOM KODJO | 0324080675 | 0324080675@htu.edu.gh
CLIFFORD ADDO | 0324080163 | 0324080163@htu.edu.gh
COURAGE HOGBE KWAME DEKU | 0324080290 | 0324080290@htu.edu.gh
DAMESI JOAN PRINCESS | 0324080412 | 0324080412@htu.edu.gh
DANIEL LAWOEKPOR | 0324080562 | 0324080562@htu.edu.gh
DANSO DERRICK | 0324080623 | 0324080623@htu.edu.gh
DAVID ADAMS | 0324080547 | 0324080547@htu.edu.gh
DERRICK TATAGAH | 0324080161 | 0324080161@htu.edu.gh
DOGBEVIA SAVIOUR | 0324080500 | 0324080500@htu.edu.gh
DOH JEPHTER SELASI | 0324080550 | 0324080550@htu.edu.gh
DON-SABAH MIGUEL SENANU | 0324080274 | 0324080274@htu.edu.gh
DRAI JZIWORNU SAMPSON | 0324080335 | 0324080335@htu.edu.gh
DUSU RAYMOND GOMEZ | 0324080175 | 0324080175@htu.edu.gh
DZAMESI CLED | 0324080132 | 0324080132@htu.edu.gh
DZAMESI COLLINS NAT | 0324080718 | 0324080718@htu.edu.gh
DZIMALE MICHAEL KOMLA | 0234080526 | 0234080526@htu.edu.gh
ELIZABETH TEY | 0323160142 | 0323160142@htu.edu.gh
EMMANUEL KWESI ODURO | 0324080140 | 0324080140@htu.edu.gh
ERIC KWASI GEBU | 0324080102 | 0324080102@htu.edu.gh
FELIX BADU-GYAMFI | 0324080561 | 0324080561@htu.edu.gh
FOSTER DODZI BANSAH | 0324080476 | 0324080476@htu.edu.gh
FOSTER MIBLEDENU | 0324080321 | 0324080321@htu.edu.gh`;

async function seedDatabase() {
  const students = studentsRaw.split('\n').filter(line => line.trim() !== '');
  
  console.log(`Starting to import ${students.length} students into Firestore...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const studentLine of students) {
    try {
      const [name, id, email] = studentLine.split('|').map(s => s.trim());
      
      const userData = {
        name,
        studentId: id,
        email,
        role: 'voter',
        createdAt: Date.now(),
        status: 'active'
      };

      // Use the student ID as the document ID, or could use email
      await setDoc(doc(db, "users", id), userData);
      console.log(`✅ Added: ${name} (${id})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to add student line: ${studentLine}`, error);
      errorCount++;
    }
  }

  console.log(`\nImport complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  process.exit(0);
}

seedDatabase();
