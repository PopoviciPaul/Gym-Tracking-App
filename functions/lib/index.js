"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchExpirationWarnings = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
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
exports.dispatchExpirationWarnings = functions.pubsub.schedule('0 11 * * *')
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
        const promises = [];
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
                promises.push(transporter.sendMail(mailOptions).catch((e) => console.error('Email failed:', e)));
            }
        });
        await Promise.all(promises);
        console.log('Finished dispatching notifications.');
    }
    catch (error) {
        console.error('Error running expiration check:', error);
    }
    return null;
});
//# sourceMappingURL=index.js.map