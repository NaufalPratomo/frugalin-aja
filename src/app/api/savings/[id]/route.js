import dbConnect from "../../../../lib/mongodb";
import SavingsGoal from "../../../../lib/models/SavingsGoal";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { name, targetAmount, currentAmount, targetDate, monthlyContribution, action, addAmount } = await req.json();

    await dbConnect();

    const goal = await SavingsGoal.findOne({ _id: id, userId: session.user.id });
    if (!goal) {
      return NextResponse.json({ message: "Target tabungan tidak ditemukan" }, { status: 404 });
    }

    if (action === "ADD_FUNDS") {
      goal.currentAmount += Number(addAmount || 0);
    } else {
      if (name) goal.name = name;
      if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount);
      if (currentAmount !== undefined) goal.currentAmount = Number(currentAmount);
      if (targetDate !== undefined) goal.targetDate = targetDate ? new Date(targetDate) : null;
      if (monthlyContribution !== undefined) goal.monthlyContribution = Number(monthlyContribution);
    }

    await goal.save();
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await dbConnect();
    await SavingsGoal.deleteOne({ _id: id, userId: session.user.id });

    return NextResponse.json({ message: "Target tabungan berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
