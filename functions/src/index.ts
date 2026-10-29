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
    
    // Calculate Bucharest dates
    function getBucharestDate(offsetDays = 0) {
      const d = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Bucharest',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(d);
      const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
      const month = parseInt(parts.find(p => p.type === 'month')!.value, 10) - 1;
      const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
      const target = new Date(Date.UTC(year, month, day + offsetDays));
      const yyyy = target.getUTCFullYear();
      const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(target.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const todayString = getBucharestDate(0);
    const threeDaysLaterString = getBucharestDate(3);
    const yesterdayString = getBucharestDate(-1);
    
    console.log(`Checking for members expiring on: Today=${todayString}, In3Days=${threeDaysLaterString}, ExpiredYesterday=${yesterdayString}`);

    try {
      const [warningSnapshot, expiredSnapshot] = await Promise.all([
        db.collection('members').where('endDate', '==', threeDaysLaterString).get(),
        db.collection('members').where('endDate', '==', yesterdayString).get()
      ]);

      const warningMessage = "Buna ziua! Abonamentul dumneavoastra la Two on One Academy va expira peste 3 zile.";
      const expiredMessage = "Buna ziua! Abonamentul dumneavoastra la Two on One Academy a expirat.";

      const promises: Promise<any>[] = [];

      // 1. Process 3-day warnings
      warningSnapshot.forEach((doc) => {
        const member = doc.data();
        if (member.wantsEmail !== false && member.email) {
          const mailOptions = {
            from: `"Two on One Academy" <${GMAIL_EMAIL}>`,
            to: member.email,
            subject: 'Abonamentul dumneavoastră la Two on One Academy expiră în curând',
            text: warningMessage,
          };
          console.log(`Sending 3-day reminder to ${member.email}`);
          promises.push(transporter.sendMail(mailOptions).catch((e: any) => console.error('Email failed:', e)));
        }
      });

      // 2. Process today's expirations
      expiredSnapshot.forEach((doc) => {
        const member = doc.data();
        if (member.wantsEmail !== false && member.email) {
          const mailOptions = {
            from: `"Two on One Academy" <${GMAIL_EMAIL}>`,
            to: member.email,
            subject: 'Abonamentul dumneavoastră la Two on One Academy a expirat',
            text: expiredMessage,
          };
          console.log(`Sending expired notice to ${member.email}`);
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
