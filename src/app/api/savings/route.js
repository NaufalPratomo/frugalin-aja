import dbConnect from "../../../lib/mongodb";
import SavingsGoal from "../../../lib/models/SavingsGoal";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const goals = await SavingsGoal.find({ userId: session.user.id });
    return NextResponse.json(goals, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { name, targetAmount, currentAmount, targetDate, monthlyContribution } = await req.json();
    if (!name || !targetAmount) {
      return NextResponse.json({ message: "Nama dan nominal target wajib diisi" }, { status: 400 });
    }

    await dbConnect();
    const newGoal = await SavingsGoal.create({
      userId: session.user.id,
      name,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount || 0),
      targetDate: targetDate ? new Date(targetDate) : undefined,
      monthlyContribution: Number(monthlyContribution || 0)
    });

    return NextResponse.json(newGoal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
