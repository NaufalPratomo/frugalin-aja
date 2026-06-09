import mongoose from 'mongoose';

const SavingsGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentAmount: { type: Number, default: 0 },
  targetDate: { type: Date },
  monthlyContribution: { type: Number, default: 0 } // Tabungan bulanan sukarela/estimasi
}, { timestamps: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.SavingsGoal) {
  delete mongoose.models.SavingsGoal;
}

export default mongoose.models.SavingsGoal || mongoose.model('SavingsGoal', SavingsGoalSchema);
