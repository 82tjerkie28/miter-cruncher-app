import React, { useState } from 'react';
import { Mail, X } from 'lucide-react';

const KeepMeInformedModal = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setSubmitted(true);
                setTimeout(() => {
                    setSubmitted(false);
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
                    <Mail className="text-orange-500" /> Keep Me Informed
                </h2>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600">
                            Enter your email to get updates about new features and releases.
                        </p>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            disabled={isSubmitting}
                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-700 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
                        >
                            {isSubmitting ? 'SUBSCRIBING...' : 'SUBSCRIBE'}
                        </button>
                    </form>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-green-500 font-bold text-lg mb-2">Thanks for subscribing!</div>
                        <p className="text-gray-500 text-sm">We'll keep you posted.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KeepMeInformedModal;
