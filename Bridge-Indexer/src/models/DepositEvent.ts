// src/models/DepositEvent.ts
import { Model, DataTypes } from "sequelize";
import sequelize from "../database";

// Interface for DepositEvent attributes
interface DepositEventAttributes {
  id?: number;
  token: string;
  from: string;
  to: string;
  amount: string;
  nonce: string;
  chainId: string;
  transactionHash: string;
  processed?: boolean;
}

// DepositEvent model class
class DepositEvent extends Model<DepositEventAttributes> implements DepositEventAttributes {
  public id!: number;
  public token!: string;
  public from!: string;
  public to!: string;
  public amount!: string;
  public nonce!: string;
  public chainId!: string;
  public transactionHash!: string;
  public processed!: boolean;
}

// Initialize the model with its structure
DepositEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    from: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    to: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nonce: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    chainId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    transactionHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "DepositEvent",
    indexes: [
      {
        // Composite unique index to prevent duplicates
        unique: true,
        fields: ["nonce", "chainId"],
      },
    ],
  }
);

// Export the model
export { DepositEvent };
