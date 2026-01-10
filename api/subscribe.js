import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email } = request.body;

    if (!email || !email.includes('@')) {
        return response.status(400).json({ error: 'Invalid email address' });
    }

    try {
        // Attempt to insert the email. ON CONFLICT DO NOTHING handles duplicates gracefully.
        await sql`
      INSERT INTO subscribers (email)
      VALUES (${email})
      ON CONFLICT (email) DO NOTHING;
    `;
        return response.status(200).json({ message: 'Subscribed successfully!' });
    } catch (error) {
        console.error('Database Error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
