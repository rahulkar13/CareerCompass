import type { Request, Response } from 'express'
import { ContactRequest } from '../models/ContactRequest'
import { env } from '../config/env'
import { emailService } from '../services/emailService'

type ContactPayload = {
  fullName: string
  email: string
  subject: string
  message: string
}

const ownerEmail = 'rahulkar849@gmail.com'

export const submitContactRequest = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as ContactPayload
  const text = [
    'New CareerCompass contact request',
    '',
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Subject: ${payload.subject}`,
    '',
    'Message:',
    payload.message,
    '',
    `Reply in CareerCompass context: ${env.appBaseUrl}`,
  ].join('\n')

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#223046">
      <h2 style="margin:0 0 16px">New CareerCompass contact request</h2>
      <p><strong>Name:</strong> ${payload.fullName}</p>
      <p><strong>Email:</strong> ${payload.email}</p>
      <p><strong>Subject:</strong> ${payload.subject}</p>
      <div style="margin-top:16px;padding:16px;border-radius:12px;background:#f5f7fb;border:1px solid #d8e0ea;white-space:pre-wrap">${payload.message}</div>
    </div>
  `

  const delivery = await emailService.send({
    to: ownerEmail,
    replyTo: payload.email,
    subject: `CareerCompass Contact: ${payload.subject}`,
    text,
    html,
  })

  const saved = await ContactRequest.create({
    ...payload,
    emailDelivered: delivery.delivered,
  })

  res.status(201).json({
    success: true,
    data: {
      id: String(saved._id),
      emailDelivered: delivery.delivered,
      message: delivery.delivered
        ? 'Your message has been sent successfully. We will get back to you soon.'
        : 'Your message has been saved successfully. Email delivery is not configured yet, so please also use the direct email address below if your request is urgent.',
    },
  })
}
