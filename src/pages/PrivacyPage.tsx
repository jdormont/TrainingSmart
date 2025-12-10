import { Link } from 'react-router-dom';
import { Shield, Database, Lock, Eye, Users, Mail } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Privacy & Data Policy</h1>
          </div>
          <p className="text-slate-300 text-lg">
            Last Updated: December 10, 2025
          </p>
        </div>

        <div className="space-y-6">
          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Data We Collect</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                We collect and process the following information to provide you with personalized training insights:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Strava Activity Data:</strong> Your cycling activities, including distance, speed, duration, and performance metrics</li>
                <li><strong className="text-white">Oura Ring Data:</strong> Sleep quality, recovery scores, and readiness metrics (if connected)</li>
                <li><strong className="text-white">Account Information:</strong> Email address and authentication credentials</li>
                <li><strong className="text-white">Training Plans:</strong> Generated training plans and workout schedules</li>
                <li><strong className="text-white">Chat History:</strong> Conversations with the AI coaching assistant</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">How We Use Your Data</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>Your data is used exclusively to provide personalized coaching services:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Generate AI-powered training insights and recommendations</li>
                <li>Create customized training plans based on your fitness level</li>
                <li>Provide real-time coaching through our chat interface</li>
                <li>Display your progress and performance metrics</li>
                <li>Improve your user experience within the application</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-green-400" />
              <h2 className="text-2xl font-semibold text-white">AI & Machine Learning Compliance</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p className="font-semibold text-white">
                We are fully compliant with Strava's API terms regarding AI/ML usage.
              </p>
              <p>
                <strong className="text-white">What this means:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your Strava data is NEVER used to train or improve AI models</li>
                <li>Data is used only as runtime context for real-time inference</li>
                <li>No fine-tuning, embeddings, or model training of any kind</li>
                <li>All processing happens in real-time and data is not retained for AI improvement</li>
                <li>We use OpenAI's API which does not train on customer data</li>
              </ul>
              <p className="mt-4">
                <Link to="/compliance" className="text-blue-400 hover:text-blue-300 underline">
                  Read our full Strava API Compliance Documentation →
                </Link>
              </p>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Data Storage & Security</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>We take data security seriously:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Encryption:</strong> All data is encrypted in transit and at rest</li>
                <li><strong className="text-white">Secure Storage:</strong> Data is stored in Supabase's secure PostgreSQL database</li>
                <li><strong className="text-white">Access Control:</strong> Row-level security policies ensure you can only access your own data</li>
                <li><strong className="text-white">Authentication:</strong> Secure email/password authentication with industry-standard practices</li>
                <li><strong className="text-white">Third-Party Services:</strong> We only integrate with trusted services (Strava, Oura, OpenAI)</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Data Sharing</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                <strong className="text-white">We do NOT sell your data.</strong> Your information is shared only in the following limited circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">OpenAI:</strong> Activity data is sent as context for AI inference (not stored by OpenAI)</li>
                <li><strong className="text-white">Strava:</strong> We fetch your data from Strava's API with your permission</li>
                <li><strong className="text-white">Oura:</strong> We fetch your data from Oura's API with your permission (if connected)</li>
              </ul>
              <p className="mt-4">
                We never share your personal data with advertisers or data brokers.
              </p>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Your Rights</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>You have the following rights regarding your data:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Access:</strong> View all your stored data at any time</li>
                <li><strong className="text-white">Deletion:</strong> Request deletion of your account and all associated data</li>
                <li><strong className="text-white">Revocation:</strong> Disconnect Strava or Oura at any time through their platforms</li>
                <li><strong className="text-white">Export:</strong> Request a copy of your data</li>
                <li><strong className="text-white">Correction:</strong> Update or correct your information</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Data Retention</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>We retain your data as follows:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Activity Data:</strong> Cached for performance, refreshed periodically</li>
                <li><strong className="text-white">Training Plans:</strong> Stored until you delete them</li>
                <li><strong className="text-white">Chat History:</strong> Stored until you delete it</li>
                <li><strong className="text-white">Account Data:</strong> Stored until you delete your account</li>
              </ul>
              <p className="mt-4">
                Upon account deletion, all your data is permanently removed from our systems within 30 days.
              </p>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                If you have questions about this privacy policy or how we handle your data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Review our technical compliance documentation in the repository</li>
                <li>Contact the development team through GitHub</li>
                <li>Submit questions through the application's feedback system</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Third-Party Services</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>We integrate with the following third-party services:</p>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-semibold text-white">Strava</p>
                  <p>We fetch your activity data via Strava's API. Review Strava's privacy policy at strava.com/legal/privacy</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Oura</p>
                  <p>We fetch your recovery data via Oura's API (if connected). Review Oura's privacy policy at ouraring.com/privacy-policy</p>
                </div>
                <div>
                  <p className="font-semibold text-white">OpenAI</p>
                  <p>We use OpenAI's API for AI coaching. Your data is sent as context for inference only. OpenAI does not use API data for training. Review OpenAI's privacy policy at openai.com/privacy</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Supabase</p>
                  <p>We use Supabase for database and authentication. Review Supabase's privacy policy at supabase.com/privacy</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Changes to This Policy</h2>
            </div>
            <div className="text-slate-300 space-y-3">
              <p>
                We may update this privacy policy from time to time. When we make changes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We will update the "Last Updated" date at the top of this page</li>
                <li>Significant changes will be communicated through the application</li>
                <li>Your continued use of the service after changes constitutes acceptance</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
