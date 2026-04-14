/**
 * Seeds Neo4j with a medical knowledge graph:
 * Symptoms → Conditions → Treatments → Medications
 *
 * Run: npm run seed
 */
import neo4j from 'neo4j-driver';
import { config } from '../src/config.ts';

const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
);

const session = driver.session();

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  await session.run('MATCH (n) DETACH DELETE n');
}

async function seedSymptoms() {
  const symptoms = [
    { id: 's1', name: 'Headache', severity: 'mild' },
    { id: 's2', name: 'Fever', severity: 'moderate' },
    { id: 's3', name: 'Fatigue', severity: 'mild' },
    { id: 's4', name: 'Chest Pain', severity: 'severe' },
    { id: 's5', name: 'Shortness of Breath', severity: 'severe' },
    { id: 's6', name: 'Nausea', severity: 'mild' },
    { id: 's7', name: 'Cough', severity: 'mild' },
    { id: 's8', name: 'Joint Pain', severity: 'moderate' },
    { id: 's9', name: 'Rash', severity: 'mild' },
    { id: 's10', name: 'Dizziness', severity: 'moderate' },
    { id: 's11', name: 'High Blood Pressure', severity: 'moderate' },
    { id: 's12', name: 'Elevated Blood Sugar', severity: 'moderate' },
    { id: 's13', name: 'Sore Throat', severity: 'mild' },
    { id: 's14', name: 'Runny Nose', severity: 'mild' },
  ];

  for (const s of symptoms) {
    await session.run(
      'CREATE (s:Symptom {id: $id, name: $name, severity: $severity})',
      s,
    );
  }
  console.log(`✅ Created ${symptoms.length} symptoms`);
}

async function seedConditions() {
  const conditions = [
    { id: 'c1', name: 'Migraine', description: 'Recurrent throbbing headaches often with nausea', icd10: 'G43' },
    { id: 'c2', name: 'Influenza', description: 'Viral respiratory infection', icd10: 'J10' },
    { id: 'c3', name: 'Hypertension', description: 'Chronically elevated blood pressure', icd10: 'I10' },
    { id: 'c4', name: 'Type 2 Diabetes', description: 'Insulin resistance and elevated blood sugar', icd10: 'E11' },
    { id: 'c5', name: 'Myocardial Infarction', description: 'Heart attack — medical emergency', icd10: 'I21' },
    { id: 'c6', name: 'Pneumonia', description: 'Lung infection', icd10: 'J18' },
    { id: 'c7', name: 'Rheumatoid Arthritis', description: 'Autoimmune joint inflammation', icd10: 'M05' },
    { id: 'c8', name: 'Common Cold', description: 'Upper respiratory viral infection', icd10: 'J00' },
    { id: 'c9', name: 'Anxiety Disorder', description: 'Chronic excessive worry and fear', icd10: 'F41' },
  ];

  for (const c of conditions) {
    await session.run(
      'CREATE (c:Condition {id: $id, name: $name, description: $description, icd10: $icd10})',
      c,
    );
  }
  console.log(`✅ Created ${conditions.length} conditions`);
}

async function seedTreatments() {
  const treatments = [
    { id: 't1', name: 'Analgesics', type: 'pharmacological', notes: 'Pain relief medication' },
    { id: 't2', name: 'Antiviral Therapy', type: 'pharmacological', notes: 'Oseltamivir for influenza' },
    { id: 't3', name: 'Antihypertensives', type: 'pharmacological', notes: 'Blood pressure lowering drugs' },
    { id: 't4', name: 'Insulin Therapy', type: 'pharmacological', notes: 'Insulin injections for diabetes' },
    { id: 't5', name: 'Metformin', type: 'pharmacological', notes: 'First-line oral diabetes medication' },
    { id: 't6', name: 'Emergency PCI', type: 'interventional', notes: 'Percutaneous coronary intervention for MI' },
    { id: 't7', name: 'Antibiotics', type: 'pharmacological', notes: 'Bacterial infection treatment' },
    { id: 't8', name: 'DMARDs', type: 'pharmacological', notes: 'Disease-modifying antirheumatic drugs' },
    { id: 't9', name: 'Rest and Hydration', type: 'supportive', notes: 'Conservative management' },
    { id: 't10', name: 'CBT Therapy', type: 'psychotherapeutic', notes: 'Cognitive behavioral therapy for anxiety' },
    { id: 't11', name: 'SSRIs', type: 'pharmacological', notes: 'Selective serotonin reuptake inhibitors' },
  ];

  for (const t of treatments) {
    await session.run(
      'CREATE (t:Treatment {id: $id, name: $name, type: $type, notes: $notes})',
      t,
    );
  }
  console.log(`✅ Created ${treatments.length} treatments`);
}

async function seedMedications() {
  const medications = [
    { id: 'm1', name: 'Ibuprofen', class: 'NSAID', commonDose: '400-600mg every 6-8h' },
    { id: 'm2', name: 'Oseltamivir', class: 'Antiviral', commonDose: '75mg twice daily for 5 days' },
    { id: 'm3', name: 'Amlodipine', class: 'Calcium Channel Blocker', commonDose: '5-10mg once daily' },
    { id: 'm4', name: 'Lisinopril', class: 'ACE Inhibitor', commonDose: '10-40mg once daily' },
    { id: 'm5', name: 'Metformin', class: 'Biguanide', commonDose: '500-1000mg twice daily with meals' },
    { id: 'm6', name: 'Insulin Glargine', class: 'Long-acting Insulin', commonDose: 'Individualized dosing' },
    { id: 'm7', name: 'Aspirin', class: 'Antiplatelet', commonDose: '81-325mg daily' },
    { id: 'm8', name: 'Methotrexate', class: 'DMARD', commonDose: '7.5-25mg weekly' },
    { id: 'm9', name: 'Sertraline', class: 'SSRI', commonDose: '50-200mg daily' },
    { id: 'm10', name: 'Amoxicillin', class: 'Antibiotic', commonDose: '500mg three times daily' },
  ];

  for (const m of medications) {
    await session.run(
      'CREATE (m:Medication {id: $id, name: $name, class: $class, commonDose: $commonDose})',
      m,
    );
  }
  console.log(`✅ Created ${medications.length} medications`);
}

async function seedRelationships() {
  const symptomConditionLinks = [
    // Migraine
    ['s1', 'c1'], ['s6', 'c1'], ['s10', 'c1'],
    // Influenza
    ['s2', 'c2'], ['s3', 'c2'], ['s7', 'c2'], ['s6', 'c2'],
    // Hypertension
    ['s11', 'c3'], ['s1', 'c3'], ['s10', 'c3'],
    // Type 2 Diabetes
    ['s12', 'c4'], ['s3', 'c4'],
    // Myocardial Infarction
    ['s4', 'c5'], ['s5', 'c5'], ['s6', 'c5'], ['s3', 'c5'],
    // Pneumonia
    ['s2', 'c6'], ['s7', 'c6'], ['s5', 'c6'], ['s3', 'c6'],
    // Rheumatoid Arthritis
    ['s8', 'c7'], ['s3', 'c7'], ['s9', 'c7'],
    // Common Cold
    ['s13', 'c8'], ['s14', 'c8'], ['s7', 'c8'], ['s2', 'c8'],
    // Anxiety
    ['s10', 'c9'], ['s4', 'c9'], ['s3', 'c9'],
  ];

  for (const [sid, cid] of symptomConditionLinks) {
    await session.run(
      'MATCH (s:Symptom {id: $sid}), (c:Condition {id: $cid}) CREATE (s)-[:INDICATES]->(c)',
      { sid, cid },
    );
  }

  const conditionTreatmentLinks = [
    ['c1', 't1'], // Migraine → Analgesics
    ['c2', 't2'], ['c2', 't9'], // Influenza → Antiviral, Rest
    ['c3', 't3'], // Hypertension → Antihypertensives
    ['c4', 't5'], ['c4', 't4'], // Diabetes → Metformin, Insulin
    ['c5', 't6'], // MI → Emergency PCI
    ['c6', 't7'], ['c6', 't9'], // Pneumonia → Antibiotics, Rest
    ['c7', 't8'], // RA → DMARDs
    ['c8', 't9'], // Cold → Rest
    ['c9', 't10'], ['c9', 't11'], // Anxiety → CBT, SSRIs
  ];

  for (const [cid, tid] of conditionTreatmentLinks) {
    await session.run(
      'MATCH (c:Condition {id: $cid}), (t:Treatment {id: $tid}) CREATE (c)-[:TREATED_BY]->(t)',
      { cid, tid },
    );
  }

  const treatmentMedicationLinks = [
    ['t1', 'm1'], // Analgesics → Ibuprofen
    ['t2', 'm2'], // Antiviral → Oseltamivir
    ['t3', 'm3'], ['t3', 'm4'], // Antihypertensives → Amlodipine, Lisinopril
    ['t5', 'm5'], // Metformin treatment → Metformin
    ['t4', 'm6'], // Insulin → Insulin Glargine
    ['t6', 'm7'], // PCI → Aspirin
    ['t7', 'm10'], // Antibiotics → Amoxicillin
    ['t8', 'm8'], // DMARDs → Methotrexate
    ['t11', 'm9'], // SSRIs → Sertraline
  ];

  for (const [tid, mid] of treatmentMedicationLinks) {
    await session.run(
      'MATCH (t:Treatment {id: $tid}), (m:Medication {id: $mid}) CREATE (t)-[:USES]->(m)',
      { tid, mid },
    );
  }

  // Contraindications
  const contraindications = [
    ['m1', 'm4', 'NSAIDs can reduce the effectiveness of ACE inhibitors'], // Ibuprofen ↔ Lisinopril
    ['m1', 'm3', 'NSAIDs may reduce antihypertensive effects'], // Ibuprofen ↔ Amlodipine
    ['m8', 'm10', 'Monitor for increased toxicity with concurrent antibiotics'], // Methotrexate ↔ Amoxicillin
  ];

  for (const [mid1, mid2, reason] of contraindications) {
    await session.run(
      `MATCH (m1:Medication {id: $mid1}), (m2:Medication {id: $mid2})
       CREATE (m1)-[:CONTRAINDICATED_WITH {reason: $reason}]->(m2)`,
      { mid1, mid2, reason },
    );
  }

  console.log(`✅ Created all relationships`);
}

async function main() {
  console.log('🌱 Seeding HealthMind AI medical knowledge graph...\n');

  try {
    await clearDatabase();
    await seedSymptoms();
    await seedConditions();
    await seedTreatments();
    await seedMedications();
    await seedRelationships();

    console.log('\n✅ Seed complete! Medical knowledge graph is ready.');
    console.log('   Nodes: Symptom, Condition, Treatment, Medication');
    console.log('   Edges: INDICATES, TREATED_BY, USES, CONTRAINDICATED_WITH\n');
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
