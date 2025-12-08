import cron from 'node-cron';
import AccessToken from '../models/AccessToken';

export const startTokenExpiryScheduler = (): void => {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🕒 Running daily token expiry job at 9:00 AM...');

      const result = await AccessToken.updateMany(
        {},
        { expiresAt: new Date() }
      );

      console.log(
        `✅ Token expiry job completed. ${result.modifiedCount} token records updated.`
      );
    } catch (error) {
      console.error('❌ Error in token expiry job:', error);
    }
  });

  console.log('⏰ Token expiry scheduler started (runs daily at 9:00 AM)');
};
