import dbConnect from "../../../lib/mongodb";
import Budget from "../../../lib/models/Budget";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const budgets = await Budget.find({ userId: session.user.id });
    return NextResponse.json(budgets, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { category, limit } = await req.json();
    if (!category || limit === undefined) {
      return NextResponse.json({ message: "Kategori dan limit wajib diisi" }, { status: 400 });
    }

    await dbConnect();

    // Update if exists, otherwise create
    const budget = await Budget.findOneAndUpdate(
      { userId: session.user.id, category },
      { limit: Math.round(Number(limit)) },
      { new: true, upsert: true }
    );

    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id, category, limit } = await req.json();
    if (!id || !category || limit === undefined) {
      return NextResponse.json({ message: "ID, kategori dan limit wajib diisi" }, { status: 400 });
    }

    await dbConnect();
    const budget = await Budget.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { category, limit: Math.round(Number(limit)) },
      { new: true }
    );

    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID budget wajib diisi" }, { status: 400 });
    }

    await dbConnect();
    await Budget.deleteOne({ _id: id, userId: session.user.id });

    return NextResponse.json({ message: "Budget berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
