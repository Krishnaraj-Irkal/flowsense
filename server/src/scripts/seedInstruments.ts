import mongoose from 'mongoose';
import Instrument from '../models/Instrument';
import { config } from 'dotenv';

config();

const NIFTY_INSTRUMENTS = [
  {
    displayName: 'NIFTY 50',
    symbol: 'NIFTY',
    securityId: '13',
    exchangeSegment: 'IDX_I',
    exchange: 'NSE',
    instrumentType: 'INDEX',
    lotSize: 75,
    tickSize: 0.05,
    futureSymbol: 'NIFTY',
    futureExchangeSegment: 'NSE_FNO',
    isActive: true
  }
  // Add more instruments here as needed
];

async function seedInstruments() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowsense';
    await mongoose.connect(mongoUri);

    console.log('Connected to MongoDB');

    // Clear existing instruments (optional - comment out to keep existing data)
    // await Instrument.deleteMany({});
    // console.log('Cleared existing instruments');

    // Insert instruments
    for (const instrumentData of NIFTY_INSTRUMENTS) {
      const existing = await Instrument.findOne({ securityId: instrumentData.securityId });

      if (existing) {
        console.log(`Instrument ${instrumentData.displayName} already exists. Updating...`);
        await Instrument.updateOne(
          { securityId: instrumentData.securityId },
          instrumentData
        );
      } else {
        console.log(`Creating instrument: ${instrumentData.displayName}`);
        await Instrument.create(instrumentData);
      }
    }

    console.log(`\nSuccessfully seeded ${NIFTY_INSTRUMENTS.length} instrument(s)`);

    // Display seeded instruments
    const instruments = await Instrument.find({ isActive: true });
    console.log('\nActive instruments:');
    instruments.forEach(inst => {
      console.log(`  - ${inst.displayName} (${inst.symbol}) - Security ID: ${inst.securityId}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding instruments:', error);
    process.exit(1);
  }
}

// Run the seed function
seedInstruments();
