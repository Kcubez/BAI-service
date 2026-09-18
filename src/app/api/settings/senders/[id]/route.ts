import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasValidStaffDepartments } from "@/lib/staff-departments";
import { updateSenderSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/settings/senders/[id] — update authorization status and allowed departments
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = updateSenderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid sender" }, { status: 400 });
  }
  const { isAuthorized, allowedDepartments } = parsed.data;

  // Verify that the sender belongs to this Business Owner
  const sender = await prisma.telegramSender.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!sender) {
    return NextResponse.json({ message: "Sender not found or access denied" }, { status: 404 });
  }

  if (allowedDepartments !== undefined && !hasValidStaffDepartments(allowedDepartments)) {
    return NextResponse.json({ message: "Please select at least one valid department" }, { status: 400 });
  }

  const nextDepartments = allowedDepartments ?? sender.allowedDepartments;
  const nextAuthorization =
    typeof isAuthorized === "boolean" ? isAuthorized : sender.isAuthorized;

  if (nextAuthorization && nextDepartments.length === 0) {
    return NextResponse.json(
      { message: "Authorized staff must have at least one department" },
      { status: 400 }
    );
  }

  const updated = await prisma.telegramSender.update({
    where: { id },
    data: {
      isAuthorized: nextAuthorization,
      allowedDepartments: nextDepartments,
    },
  });

  return NextResponse.json({
    sender: {
      ...updated,
      telegramUserId: updated.telegramUserId ? updated.telegramUserId.toString() : null,
    },
  });
}

// DELETE /api/settings/senders/[id] — revoke bot access while preserving sender history
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify that the sender belongs to this Business Owner
  const sender = await prisma.telegramSender.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!sender) {
    return NextResponse.json({ message: "Sender not found or access denied" }, { status: 404 });
  }

  await prisma.telegramSender.update({
    where: { id },
    data: {
      isAuthorized: false,
      allowedDepartments: [],
      activeReportType: "none",
    },
  });

  return NextResponse.json({ success: true });
}
