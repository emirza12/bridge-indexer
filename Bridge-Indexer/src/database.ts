import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// Create a Sequelize instance with the connection string
const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
  define: {
    timestamps: false,
  },
});

// Test database connection
sequelize.authenticate()
  .then(() => {
    console.log('Successfully connected to PostgreSQL database.');
  })
  .catch((err) => {
    console.error('Unable to connect to database:', err);
  });

// Export sequelize as default export
export default sequelize;
