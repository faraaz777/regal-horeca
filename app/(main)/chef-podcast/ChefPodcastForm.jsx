'use client';

import { useId, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Globe2,
  Instagram,
  Mail,
  MapPin,
  Mic,
  Phone,
  User,
  Utensils,
  Video,
} from 'lucide-react';
import styles from './chef-podcast-form.module.css';

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

function Section({ num, label, children, last = false }) {
  return (
    <section className={`${styles.section} ${last ? styles.sectionLast : ''}`}>
      <div className={styles.sectionLabel}>
        <div className={styles.sectionNumRow}>
          <div className={styles.sectionDot} />
          <span className={styles.sectionNum}>{num}</span>
        </div>
        <h2 className={styles.sectionTitle}>{label}</h2>
        <div className={styles.sectionLine} />
      </div>
      <div>{children}</div>
    </section>
  );
}

function Grid2({ children }) {
  return <div className={styles.grid2}>{children}</div>;
}

function FieldIcon({ icon: Icon }) {
  if (!Icon) return null;

  return <Icon className={styles.fieldIcon} strokeWidth={1.5} aria-hidden />;
}

function UnderlineInput({
  label,
  required,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon,
}) {
  const id = useId();
  const filled = value.length > 0;

  return (
    <div
      className={`${styles.field} ${icon ? styles.fieldHasIcon : ''} ${filled ? styles.fieldFilled : ''}`}
    >
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <FieldIcon icon={icon} />
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder || label}
        className={styles.fieldInput}
      />
      <div className={styles.fieldUnderline} />
    </div>
  );
}

function UnderlineSelect({ label, required, value, onChange, options, icon }) {
  const id = useId();
  const filled = value.length > 0;

  return (
    <div
      className={`${styles.field} ${icon ? styles.fieldHasIcon : ''} ${filled ? styles.fieldFilled : ''}`}
    >
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <FieldIcon icon={icon} />
      <div className={styles.selectWrap}>
        <select
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          className={`${styles.fieldSelect} ${filled ? styles.fieldSelectFilled : styles.fieldSelectEmpty}`}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.selectChevron} aria-hidden />
      </div>
      <div className={styles.fieldUnderline} />
    </div>
  );
}

function UnderlineTextarea({ label, required, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div>
      <label
        className={`${styles.textareaLabel} ${focused || filled ? styles.textareaLabelFocus : ''}`}
      >
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <div className={styles.textareaWrap}>
        <textarea
          value={value}
          onChange={onChange}
          required={required}
          rows={4}
          placeholder="Type your answer"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`${styles.textarea} ${focused ? styles.textareaFocus : ''}`}
        />
        {focused ? <div className={styles.textareaFocusBar} /> : null}
      </div>
    </div>
  );
}

function SuccessScreen({ onReset }) {
  return (
    <div className={styles.success}>
      <div className={styles.successInner}>
        <CheckCircle2 className={styles.successIcon} strokeWidth={1.25} aria-hidden />
        <div className={styles.successLine} />
        <p className={styles.successKicker}>Application Received</p>
        <h2 className={styles.successTitle}>
          THANK
          <br />
          <em className={styles.titleEm}>YOU</em>
        </h2>
        <p className={styles.successText}>
          Your registration for the Regal HoReCa Chef Podcast has been received. Our
          team will review your details and be in touch soon.
        </p>
        <div className={`${styles.successLine} ${styles.successLineBottom}`} />
        <button type="button" onClick={onReset} className={styles.successBtn}>
          Submit Another Registration
        </button>
      </div>
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
        throw new Error(result.message || 'Unable to submit registration right now.');
      }

      finishSubmission();
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(error.message || 'Unable to submit registration right now.');
    }
  };

  if (isSubmitted) {
    return (
      <div className={styles.page}>
        <SuccessScreen onReset={() => setIsSubmitted(false)} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.mastheadBg} aria-hidden>
          RC
        </div>
        <div className={styles.mastheadInner}>
          <div className={styles.topBar}>
            <div className={styles.brandMark}>
              <div className={styles.brandDot} />
              <span>Regal HoReCa</span>
            </div>
            <div className={styles.podcastMark}>
              <Mic size={13} color="#c00018" />
              <span>Chef Podcast</span>
            </div>
          </div>

          <h1 className={styles.title}>
            <span className={`${styles.titleLine} ${styles.titleSerif}`}>CHEF</span>
            <span className={`${styles.titleLine} ${styles.titlePodcast}`}>PODCAST</span>
            <span className={`${styles.titleLine} ${styles.titleSerif}`}>REGISTER</span>
          </h1>

          <div className={styles.subRow}>
            <p className={styles.subText}>
              Fill in your details if you are interested in being featured on the
              Regal HoReCa Chef Podcast.
            </p>
            <div className={styles.contactBar}>
              <a href="https://regalhoreca.com" className={styles.contactItem}>
                <Globe2 size={12} strokeWidth={1.5} aria-hidden />
                regalhoreca.com
              </a>
              <a href="mailto:info@regalhoreca.com" className={styles.contactItem}>
                <Mail size={12} strokeWidth={1.5} aria-hidden />
                info@regalhoreca.com
              </a>
              <a href="tel:+919966181000" className={styles.contactItem}>
                <Phone size={12} strokeWidth={1.5} aria-hidden />
                +91 99661 81000
              </a>
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className={styles.formBody}>
        <Section num="01" label="Personal Details">
          <Grid2>
            <UnderlineInput
              label="Full Name"
              required
              icon={User}
              value={formData.fullName}
              onChange={updateField('fullName')}
            />
            <UnderlineInput
              label="Mobile / WhatsApp Number"
              required
              type="tel"
              icon={Phone}
              value={formData.mobile}
              onChange={updateField('mobile')}
            />
            <UnderlineInput
              label="Email ID"
              required
              type="email"
              icon={Mail}
              value={formData.email}
              onChange={updateField('email')}
            />
            <UnderlineInput
              label="City / Location"
              required
              icon={MapPin}
              value={formData.city}
              onChange={updateField('city')}
            />
          </Grid2>
        </Section>

        <Section num="02" label="Professional Details">
          <Grid2>
            <UnderlineSelect
              label="Current Role / Designation"
              required
              icon={Briefcase}
              value={formData.role}
              onChange={updateField('role')}
              options={roleOptions}
            />
            <UnderlineInput
              label="Hotel / Restaurant / Brand / Company Name"
              icon={Building2}
              value={formData.company}
              onChange={updateField('company')}
            />
            <UnderlineSelect
              label="Years of Experience in HoReCa Industry"
              required
              icon={CalendarClock}
              value={formData.experience}
              onChange={updateField('experience')}
              options={experienceOptions}
            />
            <UnderlineInput
              label="Cuisine / Speciality / Area of Expertise"
              required
              icon={ChefHat}
              value={formData.cuisine}
              onChange={updateField('cuisine')}
            />
          </Grid2>
        </Section>

        <Section num="03" label="Podcast Interest">
          <div className={styles.stack}>
            <UnderlineSelect
              label="Would you like to be part of the Regal HoReCa Chef Podcast?"
              required
              icon={Mic}
              value={formData.podcastInterest}
              onChange={updateField('podcastInterest')}
              options={podcastInterestOptions}
            />
            <UnderlineTextarea
              label="What topics, experiences, or stories would you like to share?"
              required
              value={formData.topics}
              onChange={updateField('topics')}
            />
            <UnderlineTextarea
              label="Any special achievement, signature dish, or story to highlight?"
              value={formData.achievement}
              onChange={updateField('achievement')}
            />
          </div>
        </Section>

        <Section num="04" label="Social Media & Public Profile">
          <Grid2>
            <UnderlineInput
              label="Instagram Handle"
              icon={Instagram}
              value={formData.instagram}
              onChange={updateField('instagram')}
            />
            <UnderlineInput
              label="YouTube / Website / Portfolio / Article Link"
              icon={Globe2}
              value={formData.portfolio}
              onChange={updateField('portfolio')}
            />
            <div className={styles.fullWidth}>
              <UnderlineSelect
                label="Are you comfortable being recorded on video for social media and promotional use?"
                required
                icon={Video}
                value={formData.videoConsent}
                onChange={updateField('videoConsent')}
                options={videoConsentOptions}
              />
            </div>
          </Grid2>
        </Section>

        <Section num="05" label="Availability">
          <Grid2>
            <UnderlineInput
              label="Preferred Day / Time for a Follow-up Call"
              icon={CalendarClock}
              value={formData.followUpTime}
              onChange={updateField('followUpTime')}
              placeholder="e.g. Monday evening"
            />
            <UnderlineSelect
              label="Preferred Podcast Recording Availability"
              icon={Utensils}
              value={formData.recordingAvailability}
              onChange={updateField('recordingAvailability')}
              options={recordingAvailabilityOptions}
            />
          </Grid2>
        </Section>

        <Section num="06" label="Consent" last>
          <label className={styles.consentLabel}>
            <div
              className={`${styles.consentBox} ${formData.consent ? styles.consentBoxChecked : ''}`}
            >
              <input
                type="checkbox"
                required
                checked={formData.consent}
                onChange={updateField('consent')}
                className={styles.consentInput}
              />
              {formData.consent ? (
                <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden>
                  <path
                    d="M1 4L4.5 7.5L11 1"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </div>
            <p className={styles.consentText}>
              I agree that Regal HoReCa may contact me regarding the Chef Podcast,
              shortlisting, planning, recording, and related promotional activities.
              <span className={styles.required}> *</span>
            </p>
          </label>
        </Section>

        {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

        <div className={styles.submitRow}>
          <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
            {isSubmitting ? 'Submitting...' : 'Submit Registration'}
            <ArrowUpRight size={16} />
          </button>
          <p className={styles.submitHint}>
            Fields marked <span className={styles.required}>*</span> are required.
          </p>
        </div>
      </form>
    </div>
  );
}
