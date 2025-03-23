import { Model, DataTypes } from "sequelize";
import sequelize from "../database";

// Interface for DistributionEvent attributes
interface DistributionEventAttributes {
  id?: number;
  token: string;
  to: string;
  amount: string;
  nonce: string;
  chainId: string;
  processed?: boolean;
}

// DistributionEvent model class
class DistributionEvent extends Model<DistributionEventAttributes> implements DistributionEventAttributes {
  public id!: number;
  public token!: string;
  public to!: string;
  public amount!: string;
  public nonce!: string;
  public chainId!: string;
  public processed!: boolean;
}

// Initialize the model with its structure
DistributionEvent.init(
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
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "DistributionEvent",
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
export { DistributionEvent }; 