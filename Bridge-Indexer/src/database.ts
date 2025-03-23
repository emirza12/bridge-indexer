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

// Connection test will be performed in index.ts
// We're removing it here to avoid duplicate logs

// Export sequelize as default export
export default sequelize;
