'use client';

import { useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Globe2,
  Instagram,
  Mail,
  MapPin,
  Mic,
  Phone,
  Send,
  User,
  Utensils,
  Video,
} from 'lucide-react';

/**
 * Google Forms requires these exact entry IDs.
 * If the linked Google Form questions are recreated,
 * these IDs must be remapped from a fresh pre-filled link.
 */
const fields = {
  fullName: 'entry.1883460570',
  mobile: 'entry.633687695',
  email: 'entry.1507298541',
  city: 'entry.595041890',
  role: 'entry.1757567893',
  company: 'entry.137354594',
  experience: 'entry.672550243',
  cuisine: 'entry.1065073397',
  podcastInterest: 'entry.520236308',
  topics: 'entry.677622808',
  achievement: 'entry.1274931007',
  instagram: 'entry.1947627503',
  portfolio: 'entry.2095500058',
  videoConsent: 'entry.1339344912',
  followUpTime: 'entry.1875542037',
  recordingAvailability: 'entry.1664340553',
  consent: 'entry.1082564949',
};

const initialFormData = {
  fullName: '',
  mobile: '',
  email: '',
  city: '',
  role: '',
  company: '',
  experience: '',
  cuisine: '',
  podcastInterest: '',
  topics: '',
  achievement: '',
  instagram: '',
  portfolio: '',
  videoConsent: '',
  followUpTime: '',
  recordingAvailability: '',
  consent: false,
};

const roleOptions = [
  'Executive Chef',
  'Head Chef',
  'Sous Chef',
  'Pastry Chef',
  'Commis Chef',
  'Culinary Professional',
  'Restaurant Owner',
  'Café Owner',
  'Catering Professional',
  'Banquet Professional',
  'Hotel / Restaurant Manager',
  'Food & Beverage Professional',
  'Culinary Student',
  'Other',
];

const experienceOptions = [
  '0–2 years',
  '3–5 years',
  '6–10 years',
  '10–15 years',
  '15+ years',
];

const podcastInterestOptions = ['Yes', 'Need more details', 'Not at the moment'];

const videoConsentOptions = [
  'Yes',
  'Need more details first',
  'Audio only preferred',
  'Not comfortable',
];

const recordingAvailabilityOptions = [
  'Weekday Morning',
  'Weekday Afternoon',
  'Weekday Evening',
  'Weekend Morning',
  'Weekend Afternoon',
  'Weekend Evening',
  'Flexible / Can discuss',
];

function Section({ number, title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0e11]/95 p-4 shadow-2xl shadow-black/30 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-white shadow-lg shadow-accent/20">
          {number}
        </span>
        <h2 className="text-base font-black uppercase tracking-wide text-white sm:text-lg">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold text-white sm:text-sm">
      {children}
      {required ? <span className="ml-1 text-accent">*</span> : null}
    </label>
  );
}

function FieldShell({ icon: Icon, children }) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-4 top-[42px] h-4 w-4 text-white/45" />
      ) : null}
      {children}
    </div>
  );
}

function TextInput({
  id,
  name,
  label,
  value,
  onChange,
  icon,
  type = 'text',
  placeholder,
  required = false,
  className = '',
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <FieldShell icon={icon}>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-70 data-[has-icon=true]:pl-11"
          data-has-icon={icon ? 'true' : 'false'}
        />
      </FieldShell>
    </div>
  );
}

function TextArea({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  className = '',
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        rows={4}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  icon,
  className = '',
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <FieldShell icon={icon}>
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full appearance-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 data-[has-icon=true]:pl-11"
          data-has-icon={icon ? 'true' : 'false'}
        >
          <option value="" className="bg-[#101114] text-white/60">
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option} className="bg-[#101114] text-white">
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-[43px] text-xs text-white/45">
          v
        </span>
      </FieldShell>
    </div>
  );
}

export default function ChefPodcastForm() {
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const updateField = (field) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const finishSubmission = () => {
    setIsSubmitting(false);
    setIsSubmitted(true);
    setFormData(initialFormData);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setIsSubmitted(false);
    setErrorMessage('');

    try {
      const response = await fetch('/api/chef-podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message || 'Unable to submit registration right now.'
        );
      }

      finishSubmission();
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(
        error.message || 'Unable to submit registration right now.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(238,64,35,0.24),transparent_34%),radial-gradient(circle_at_top_left,rgba(238,64,35,0.12),transparent_28%)]" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-6 text-center sm:mb-10">
            <div className="flex items-center justify-center gap-3 sm:justify-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/60 bg-accent/10">
                <span className="text-xl font-black italic text-accent">R</span>
              </div>
              <span className="text-3xl font-black tracking-tight text-white">Regal</span>
            </div>

            <div className="mx-auto max-w-3xl">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-2xl shadow-accent/25">
                <Mic className="h-8 w-8" />
              </div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.4em] text-accent">
                Chef Podcast
              </p>
              <h1 className="text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Registration Form
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Fill in your details if you are interested in being featured on the
                Regal HoReCa Chef Podcast.
              </p>
            </div>
          </div>

          {isSubmitted ? (
            <div className="mx-auto max-w-2xl rounded-3xl border border-accent/30 bg-[#0d0e11] p-8 text-center shadow-2xl shadow-accent/10">
              <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-accent" />
              <h2 className="text-2xl font-black uppercase text-white">
                Registration Submitted
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Thank you for sharing your details. The Regal HoReCa team will review
                your registration and contact you for the next steps.
              </p>
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="mt-6 rounded-xl border border-white/10 px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:border-accent hover:text-accent"
              >
                Submit Another Registration
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <Section number="1" title="Personal Details">
                <TextInput
                  id="chef-full-name"
                  name={fields.fullName}
                  label="Full Name"
                  value={formData.fullName}
                  onChange={updateField('fullName')}
                  required
                  icon={User}
                  placeholder="Enter your full name"
                />
                <TextInput
                  id="chef-mobile"
                  name={fields.mobile}
                  label="Mobile Number / WhatsApp Number"
                  value={formData.mobile}
                  onChange={updateField('mobile')}
                  required
                  icon={Phone}
                  type="tel"
                  placeholder="Enter your mobile number"
                />
                <TextInput
                  id="chef-email"
                  name={fields.email}
                  label="Email ID"
                  value={formData.email}
                  onChange={updateField('email')}
                  required
                  icon={Mail}
                  type="email"
                  placeholder="Enter your email address"
                />
                <TextInput
                  id="chef-city"
                  name={fields.city}
                  label="City / Location"
                  value={formData.city}
                  onChange={updateField('city')}
                  required
                  icon={MapPin}
                  placeholder="Enter your city / location"
                />
              </Section>

              <Section number="2" title="Professional Details">
                <SelectField
                  id="chef-role"
                  name={fields.role}
                  label="Current Role / Designation"
                  value={formData.role}
                  onChange={updateField('role')}
                  required
                  icon={Briefcase}
                  options={roleOptions}
                  placeholder="Select your role"
                />
                <TextInput
                  id="chef-company"
                  name={fields.company}
                  label="Hotel / Restaurant / Brand / Company Name"
                  value={formData.company}
                  onChange={updateField('company')}
                  icon={Building2}
                  placeholder="Enter name"
                />
                <SelectField
                  id="chef-experience"
                  name={fields.experience}
                  label="Years of Experience in the Food / HoReCa Industry"
                  value={formData.experience}
                  onChange={updateField('experience')}
                  required
                  icon={CalendarClock}
                  options={experienceOptions}
                  placeholder="Select experience"
                />
                <TextInput
                  id="chef-cuisine"
                  name={fields.cuisine}
                  label="Cuisine / Speciality / Area of Expertise"
                  value={formData.cuisine}
                  onChange={updateField('cuisine')}
                  required
                  icon={ChefHat}
                  placeholder="Enter your cuisine / speciality"
                />
              </Section>

              <Section number="3" title="Podcast Interest">
                <SelectField
                  id="chef-podcast-interest"
                  name={fields.podcastInterest}
                  label="Would you like to be part of the Regal HoReCa Chef Podcast?"
                  value={formData.podcastInterest}
                  onChange={updateField('podcastInterest')}
                  required
                  icon={Mic}
                  options={podcastInterestOptions}
                  placeholder="Select an option"
                />
                <TextArea
                  id="chef-topics"
                  name={fields.topics}
                  label="What topics, experiences, or stories would you like to share during the podcast?"
                  value={formData.topics}
                  onChange={updateField('topics')}
                  required
                  placeholder="Type your answer"
                />
                <TextArea
                  id="chef-achievement"
                  name={fields.achievement}
                  label="Do you have any special achievement, signature dish, professional story, or experience you would like to highlight?"
                  value={formData.achievement}
                  onChange={updateField('achievement')}
                  placeholder="Type your answer"
                  className="md:col-span-2"
                />
              </Section>

              <Section number="4" title="Social Media & Public Profile">
                <TextInput
                  id="chef-instagram"
                  name={fields.instagram}
                  label="Instagram Handle"
                  value={formData.instagram}
                  onChange={updateField('instagram')}
                  icon={Instagram}
                  placeholder="Enter your Instagram handle"
                />
                <TextInput
                  id="chef-portfolio"
                  name={fields.portfolio}
                  label="YouTube / Website / Portfolio / Article Link"
                  value={formData.portfolio}
                  onChange={updateField('portfolio')}
                  icon={Globe2}
                  placeholder="Enter link"
                />
                <SelectField
                  id="chef-video-consent"
                  name={fields.videoConsent}
                  label="Are you comfortable being recorded on video for social media and promotional use?"
                  value={formData.videoConsent}
                  onChange={updateField('videoConsent')}
                  required
                  icon={Video}
                  options={videoConsentOptions}
                  placeholder="Select an option"
                  className="md:col-span-2"
                />
              </Section>

              <Section number="5" title="Availability">
                <TextInput
                  id="chef-follow-up"
                  name={fields.followUpTime}
                  label="Preferred Day / Time for a Follow-up Call"
                  value={formData.followUpTime}
                  onChange={updateField('followUpTime')}
                  icon={CalendarClock}
                  placeholder="Example: Monday evening, weekend morning"
                />
                <SelectField
                  id="chef-recording-availability"
                  name={fields.recordingAvailability}
                  label="Preferred Podcast Recording Availability"
                  value={formData.recordingAvailability}
                  onChange={updateField('recordingAvailability')}
                  icon={Utensils}
                  options={recordingAvailabilityOptions}
                  placeholder="Select availability"
                />
              </Section>

              <section className="rounded-2xl border border-white/10 bg-[#0d0e11]/95 p-4 shadow-2xl shadow-black/30 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-white shadow-lg shadow-accent/20">
                    6
                  </span>
                  <h2 className="text-base font-black uppercase tracking-wide text-white sm:text-lg">
                    Consent
                  </h2>
                </div>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/80">
                  <input
                    type="checkbox"
                    name={fields.consent}
                    value="I Agree"
                    checked={formData.consent}
                    onChange={updateField('consent')}
                    required
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-accent"
                  />
                  <span>
                    I agree that Regal HoReCa may contact me regarding the Chef
                    Podcast, shortlisting, planning, recording, and related promotional
                    activities. <span className="text-accent">*</span>
                  </span>
                </label>
              </section>

              {errorMessage ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="sticky bottom-4 z-10 flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-accent/25 transition hover:bg-[#d9361d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}

          <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-[#0d0e11]/80 p-4 text-xs font-bold text-white/75 sm:grid-cols-3">
            <a href="https://regalhoreca.com" className="flex items-center justify-center gap-2 hover:text-accent">
              <Globe2 className="h-4 w-4 text-accent" />
              regalhoreca.com
            </a>
            <a href="mailto:info@regalhoreca.com" className="flex items-center justify-center gap-2 hover:text-accent">
              <Mail className="h-4 w-4 text-accent" />
              info@regalhoreca.com
            </a>
            <a href="tel:+919966181000" className="flex items-center justify-center gap-2 hover:text-accent">
              <Phone className="h-4 w-4 text-accent" />
              +91 99661 81000
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
