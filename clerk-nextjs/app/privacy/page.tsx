"use client";

import { Header } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { InfiniteGridBg } from "@/components/ui/infinite-grid-bg";

const SUPPORT_EMAIL = "support@browsersky.dev";

const sections = [
  {
    title: "1. Overview",
    content: `BrowserSky AI ("we", "us", or "our") is a Chrome browser extension and associated website that lets you ask AI-powered questions about webpages you visit. This Privacy Policy explains what information we collect, how we use it, who we share it with, and what choices you have. By using the Service, you agree to the practices described here.`,
  },
  {
    title: "2. Information We Collect",
    content: `We collect the following categories of information:\n\nAccount Information\nWhen you create an account, we collect your name, email address, and profile image URL through Clerk, our authentication provider.\n\nPage Content\nWhen you submit a question with the extension open, the extension reads the visible text (title, URL, and body text up to 50,000 characters) from your active browser tab. For certain complex applications where text extraction is insufficient — including Google Docs, Google Sheets, Google Slides, Figma, Notion, Canva, Miro, Linear, Asana, Trello, and LinkedIn post/article editors — the extension captures a JPEG screenshot of the visible portion of the page instead. This content is transmitted to our backend servers solely to generate your AI response.\n\nQueries & Conversation History\nThe questions you type and the AI responses generated are held in the extension's service worker memory for the duration of your browser session. This history is used to give the AI context for follow-up questions. It is not written to disk and is lost when the browser closes or the extension reloads.\n\nUsage & Credit Data\nWe store your current credit balance, credit reset timestamp, and subscription tier (Free or Pro) in Chrome's local storage on your device.\n\nPayment Information\nWhen you subscribe to Pro, payment is processed entirely by LemonSqueezy. We do not receive or store your credit card number or full payment details. We receive a confirmation of your subscription status from LemonSqueezy via webhook.`,
  },
  {
    title: "3. How We Use Your Information",
    content: `We use the information we collect to:\n\n• Authenticate you and maintain your session\n• Process your queries by sending page content and your question to AI model providers\n• Track and enforce credit usage limits\n• Process and confirm subscription payments\n• Respond to support requests\n• Improve the reliability and performance of the Service\n\nWe do not use your page content or queries to train AI models, build advertising profiles, or sell data to third parties.`,
  },
  {
    title: "4. Information We Share",
    content: `We share your data only as necessary to deliver the Service:\n\nAI Model Providers\nYour query and the extracted page content (text or screenshot) are transmitted to one of the following providers depending on the model you select:\n• OpenAI (GPT-4o, GPT-4o-mini) — openai.com\n• Anthropic (Claude Sonnet, Claude Haiku) — anthropic.com\n• xAI (Grok-3, Grok-3-mini) — x.ai\n• MiniMax (MiniMax-Text-01) — minimaxi.com\n\nEach provider has its own privacy policy. We encourage you to review them, especially for sensitive pages.\n\nClerk (Authentication)\nUser registration, login, and session tokens are managed by Clerk. Clerk stores your email address and profile information on our behalf. See clerk.com/privacy.\n\nLemonSqueezy (Payments)\nSubscription billing is handled by LemonSqueezy. They process your payment information directly and are subject to their own privacy policy. See lemonsqueezy.com/privacy.\n\nLegal Requirements\nWe may disclose your information if required by law, court order, or to protect the rights, property, or safety of BrowserSky AI, our users, or the public.`,
  },
  {
    title: "5. Data Storage & Retention",
    content: `Data is stored in the following locations:\n\nOn Your Device (Chrome Storage)\n• chrome.storage.local: Your authentication token, name, email, profile image URL, credit balance, reset timestamp, and subscription tier. This data persists until you sign out or uninstall the extension.\n• chrome.storage.session: Cached page context (title, URL, extracted text) for the current tab. Cleared automatically when the tab is closed.\n• Service worker memory: Conversation history for open tabs. Cleared when the browser closes or the extension reloads.\n\nOn Our Servers\nPage content and queries are processed in real time and are not stored beyond the duration needed to generate and return a response.\n\nAccount data held by Clerk is retained for as long as your account is active. You may request deletion at any time by contacting us.`,
  },
  {
    title: "6. Browser Permissions & What They Access",
    content: `The extension requests the following Chrome permissions. Here is what each accesses and why:\n\n• All websites (<all_urls>): Allows the extension to read page content from any site you choose to analyze. The extension only reads content when you actively submit a question — it does not passively monitor your browsing.\n• Active tab & scripting: Used to inject the content-extraction script into the current tab when you ask a question.\n• Storage: Used to save your auth token, credits, and tier locally on your device.\n• Side panel: Renders the chat interface in Chrome's native side panel.\n• Tab groups: Optionally groups open tabs under the "BrowserSky AI" label.`,
  },
  {
    title: "7. Cookies & Tracking",
    content: `The BrowserSky AI extension itself does not use cookies. The website (browsersky.dev) may use cookies set by Clerk for authentication purposes (e.g., session tokens). We do not use third-party advertising cookies or cross-site tracking.`,
  },
  {
    title: "8. Children's Privacy",
    content: `The Service is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.`,
  },
  {
    title: "9. Your Rights & Choices",
    content: `You have the following rights regarding your data:\n\n• Access: You can view the account information stored in your profile via the Settings page.\n• Deletion: You can delete your account and request removal of your data by contacting us at the email address below.\n• Uninstall: Removing the extension immediately clears all data stored in chrome.storage.\n• Opt out: You can stop using the Service at any time. If you cancel a Pro subscription, it remains active until the end of the billing period.\n\nDepending on your jurisdiction, you may have additional rights under laws such as GDPR or CCPA. Contact us to exercise those rights.`,
  },
  {
    title: "10. Security",
    content: `We use HTTPS for all data transmission between the extension, our backend, and third-party providers. Authentication is handled via short-lived JWT tokens issued by Clerk and refreshed silently in the background. We do not store raw passwords. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "11. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date below. Your continued use of the Service after changes are posted constitutes your acceptance of the updated policy. For significant changes, we will make reasonable efforts to notify you.`,
  },
  {
    title: "12. Contact Us",
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:`,
  },
];

export default function PrivacyPage() {
  return (
    <div
      className="relative min-h-screen flex flex-col font-[family-name:var(--font-gelasio)]"
      style={{ background: "#0f1f27" }}
    >
      <div className="relative flex-1">
        <InfiniteGridBg />
        <Header />
        <main className="px-6 pt-36 pb-24">
          <div className="max-w-3xl mx-auto">
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-semibold text-white mb-2">
              Privacy Policy
            </h1>
            <p className="text-white/30 text-sm mb-12">
              Last updated: March 15, 2026
            </p>

            {/* Sections */}
            <div className="flex flex-col gap-10">
              {sections.map((section) => (
                <div key={section.title}>
                  <h2 className="text-base font-semibold text-white mb-3">
                    {section.title}
                  </h2>
                  {section.content.split("\n").map((line, i) =>
                    line === "" ? (
                      <div key={i} className="h-3" />
                    ) : (
                      <p
                        key={i}
                        className="text-white/55 text-sm leading-relaxed"
                      >
                        {line}
                      </p>
                    )
                  )}
                  {section.title.startsWith("12.") && (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="inline-block mt-2 text-sm text-white/70 hover:text-white underline underline-offset-2 transition-colors"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
