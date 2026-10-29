const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// 1. Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let serviceAccount;
      if (typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string' && process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{')) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else {
        serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with provided service account.');
    } catch (err) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT, falling back to default:', err.message);
      admin.initializeApp();
    }
  } else {
    // Default application credentials or local environment
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials.');
  }
}

const db = admin.firestore();

// 2. Setup Nodemailer Transporter
const GMAIL_EMAIL = '201martialarts@gmail.com';
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD || 'qxbzsdcgucoleybc';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_PASSWORD,
  },
});

/**
 * Calculates a date in YYYY-MM-DD format for Europe/Bucharest timezone with a days offset.
 */
function getBucharestDateString(daysOffset = 0) {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);

  const targetDate = new Date(Date.UTC(year, month, day + daysOffset));
  const yyyy = targetDate.getUTCFullYear();
  const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function runDailyExpirationCheck() {
  const todayString = getBucharestDateString(0);
  const threeDaysLaterString = getBucharestDateString(3);

  console.log(`[Daily Check] Bucharest Today: ${todayString}`);
  console.log(`[Daily Check] Bucharest In 3 Days: ${threeDaysLaterString}`);

  // Message 1: 3 days before expiration
  const warningText = 'Buna ziua! Abonamentul dumneavoastra la Two on One Academy va expira peste 3 zile.';
  const warningSubject = 'Abonamentul dumneavoastră la Two on One Academy expiră în curând';

  // Message 2: On the day of expiration
  const expiredText = 'Buna ziua! Abonamentul dumneavoastra la Two on One Academy a expirat.';
  const expiredSubject = 'Abonamentul dumneavoastră la Two on One Academy a expirat';

  // Query 1: Members expiring in 3 days
  console.log(`Checking for members expiring on ${threeDaysLaterString} (3-day reminder)...`);
  const warningSnapshot = await db.collection('members').where('endDate', '==', threeDaysLaterString).get();

  // Query 2: Members expiring today
  console.log(`Checking for members expiring on ${todayString} (expired today)...`);
  const expiredSnapshot = await db.collection('members').where('endDate', '==', todayString).get();

  const emailPromises = [];

  // Process 3-day warnings
  if (warningSnapshot.empty) {
    console.log('No members expiring in 3 days.');
  } else {
    console.log(`Found ${warningSnapshot.size} member(s) expiring in 3 days:`);
    warningSnapshot.forEach(doc => {
      const member = doc.data();
      if (member.wantsEmail !== false && member.email) {
        console.log(` -> Sending 3-day reminder to: ${member.firstName} ${member.lastName} (${member.email})`);
        const mailOptions = {
          from: `"Two on One Academy" <${GMAIL_EMAIL}>`,
          to: member.email,
          subject: warningSubject,
          text: warningText,
        };
        emailPromises.push(
          transporter.sendMail(mailOptions).catch(err => {
            console.error(`Failed to send 3-day email to ${member.email}:`, err.message);
          })
        );
      } else {
        console.log(` -> Skipping ${member.firstName} ${member.lastName} (email: ${member.email}, wantsEmail: ${member.wantsEmail})`);
      }
    });
  }

  // Process today's expired members
  if (expiredSnapshot.empty) {
    console.log('No members expiring today.');
  } else {
    console.log(`Found ${expiredSnapshot.size} member(s) expiring today:`);
    expiredSnapshot.forEach(doc => {
      const member = doc.data();
      if (member.wantsEmail !== false && member.email) {
        console.log(` -> Sending expired email to: ${member.firstName} ${member.lastName} (${member.email})`);
        const mailOptions = {
          from: `"Two on One Academy" <${GMAIL_EMAIL}>`,
          to: member.email,
          subject: expiredSubject,
          text: expiredText,
        };
        emailPromises.push(
          transporter.sendMail(mailOptions).catch(err => {
            console.error(`Failed to send expired email to ${member.email}:`, err.message);
          })
        );
      } else {
        console.log(` -> Skipping ${member.firstName} ${member.lastName} (email: ${member.email}, wantsEmail: ${member.wantsEmail})`);
      }
    });
  }

  await Promise.all(emailPromises);
  console.log('[Daily Check] All email tasks completed successfully.');
}

runDailyExpirationCheck()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error during execution:', err);
    process.exit(1);
  });
