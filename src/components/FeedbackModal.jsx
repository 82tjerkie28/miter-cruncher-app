import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

const FeedbackModal = ({ isOpen, onClose }) => {
    const [feedback, setFeedback] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!feedback.trim()) {
            alert('Please enter your feedback.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: feedback, name, email }),
            });

            const data = await response.json();

            if (response.ok) {
                setSubmitted(true);
                setTimeout(() => {
                    setSubmitted(false);
                    setFeedback('');
                    setName('');
                    setEmail('');
                    onClose();
                }, 2000);
            } else {
                alert(data.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to connect to the server.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-blue-100">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="text-orange-500" /> Feedback
                </h2>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600">
                            Found a bug or have a suggestion? Let us know!
                        </p>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Name (optional)"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-700 disabled:opacity-50"
                            />
                            <input
                                type="email"
                                placeholder="Email (optional)"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-700 disabled:opacity-50"
                            />
                        </div>
                        <textarea
                            required
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Your feedback here..."
                            rows={4}
                            disabled={isSubmitting}
                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-700 resize-none disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
                        >
                            {isSubmitting ? 'SENDING...' : 'SEND FEEDBACK'}
                        </button>
                    </form>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-green-500 font-bold text-lg mb-2">Message Sent!</div>
                        <p className="text-gray-500 text-sm">Thank you for your feedback.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
