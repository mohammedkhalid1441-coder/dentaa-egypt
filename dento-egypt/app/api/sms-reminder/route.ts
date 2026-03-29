// app/api/sms-reminder/route.ts
// Sends appointment reminder SMS via Twilio
// Call this from a cron job or manually from the appointments page

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { appointmentId } = await req.json()

  // Fetch appointment with patient info
  const { data: appt, error } = await supabase
    .from('appointments')
    .select('*, patients(first_name, last_name, phone)')
    .eq('id', appointmentId)
    .single()

  if (error || !appt) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  const patient = appt.patients as { first_name: string; last_name: string; phone: string }
  const phone = patient.phone.replace(/[^0-9+]/g, '') // strip non-numeric chars

  // Format Egyptian number: 010XXXXXXXX → +2010XXXXXXXX
  const formatted = phone.startsWith('+') ? phone : `+2${phone}`

  const message =
    `مرحباً ${patient.first_name}، تذكير بموعدك في عيادة دنتو مصر:\n` +
    `التاريخ: ${appt.date}\n` +
    `الوقت: ${appt.time}\n` +
    `العلاج: ${appt.treatment}\n` +
    `الطبيب: ${appt.doctor}\n` +
    `نتطلع لرؤيتك! للاستفسار اتصل بالعيادة.`

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formatted,
    })
    return NextResponse.json({ success: true, sentTo: formatted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: send reminders for ALL appointments tomorrow (call this from a daily cron)
export async function GET() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().slice(0, 10)

  const { data: appts } = await supabase
    .from('appointments')
    .select('id')
    .eq('date', dateStr)
    .eq('status', 'Confirmed')

  if (!appts || appts.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No confirmed appointments tomorrow' })
  }

  const results = await Promise.allSettled(
    appts.map(a =>
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/sms-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: a.id }),
      })
    )
  )

  return NextResponse.json({ sent: results.filter(r => r.status === 'fulfilled').length })
}
