import mongoose from 'mongoose';

const BudgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true }
}, { timestamps: true });

// Prevent caching in dev environment
if (process.env.NODE_ENV === 'development' && mongoose.models.Budget) {
  delete mongoose.models.Budget;
}

export default mongoose.models.Budget || mongoose.model('Budget', BudgetSchema);
