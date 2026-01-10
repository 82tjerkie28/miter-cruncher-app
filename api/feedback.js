import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message } = request.body;

    if (!message || message.trim().length === 0) {
        return response.status(400).json({ error: 'Message cannot be empty' });
    }

    try {
        await sql`
      INSERT INTO feedback (message)
      VALUES (${message});
    `;
        return response.status(200).json({ message: 'Feedback sent successfully!' });
    } catch (error) {
        console.error('Database Error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
