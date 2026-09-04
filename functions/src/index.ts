import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// We will fetch these from Firebase Environment Secrets later
const GMAIL_EMAIL = "201martialarts@gmail.com";
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD || "qxbzsdcgucoleybc";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_PASSWORD,
  },
});

export const dispatchExpirationWarnings = functions.pubsub.schedule('0 11 * * *')
  .timeZone('Europe/Bucharest')
  .onRun(async (context) => {
    console.log('Starting daily expiration check...');
    
    // Get today's date in YYYY-MM-DD format based on Romanian timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayString = formatter.format(now);
    
    console.log(`Checking for members expiring on: ${todayString}`);

    try {
      const snapshot = await db.collection('members').where('endDate', '==', todayString).get();
      
      if (snapshot.empty) {
        console.log('No memberships expiring today.');
        return null;
      }

      console.log(`Found ${snapshot.size} members expiring today. Processing...`);

      const message = "Abonamentul dumneavoastra la 201 a expirat.";

      const promises: Promise<any>[] = [];

      snapshot.forEach((doc) => {
        const member = doc.data();
        
        // Dispatch Email if requested and available
        if (member.wantsEmail !== false && member.email) {
          const mailOptions = {
            from: `"201 Martial Arts Academy" <${GMAIL_EMAIL}>`,
            to: member.email,
            subject: 'Abonament Expirat',
            text: message,
          };
          console.log(`Sending email to ${member.email}`);
          promises.push(transporter.sendMail(mailOptions).catch((e: any) => console.error('Email failed:', e)));
        }
      });

      await Promise.all(promises);
      console.log('Finished dispatching notifications.');

    } catch (error) {
      console.error('Error running expiration check:', error);
    }
    
    return null;
  });
