import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import frOverridesCommon from './fr-overrides.mjs';
import frOverridesRest from './fr-overrides-rest.mjs';
import mobileKeys from './mobile-keys.mjs';
import mobileKeysFr from './mobile-keys-fr.mjs';

const root = dirname(fileURLToPath(import.meta.url));

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const existing = target[key];
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        target[key] = deepMerge(existing, val);
      } else {
        target[key] = deepMerge({}, val);
      }
    } else {
      target[key] = val;
    }
  }
  return target;
}

/** next-intl and mobile i18n use `{var}` — normalize i18next-style `{{var}}` on output. */
function normalizeInterpolation(value) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, '{$1}');
  }
  if (Array.isArray(value)) {
    return value.map(normalizeInterpolation);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeInterpolation(nested)])
    );
  }
  return value;
}

const en = {
  common: {
    metadata: {
      title: 'Lootopia — Treasure Hunts Reimagined',
      description:
        'Discover treasure hunts, track your progress, and play immersive adventures in the Lootopia mobile app.',
    },
    localeSwitcher: {
      label: 'Language',
      en: 'English',
      fr: 'Français',
    },
    languageEnglish: 'English',
    languageFrench: 'Français',
    guest: 'Guest',
    offline: 'offline',
    cancel: 'Cancel',
    delete: 'Delete',
    back: '← Back',
    create: 'Create',
    save: 'Save',
    close: 'Close',
    confirm: 'Confirm',
    continue: 'Continue',
    send: 'Send',
    submit: 'Submit',
    or: 'or',
    roles: {
      admin: 'Administrator',
      partner: 'Partner',
      player: 'Player',
    },
    avatar: {
      male: 'Male',
      female: 'Female',
    },
    difficulty: {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    },
    status: {
      draft: 'Draft',
      active: 'Active',
      archived: 'Archived',
      paused: 'Paused',
    },
    placeholders: {
      title: 'Title',
      description: 'Description',
      latitude: 'Latitude',
      longitude: 'Longitude',
      answer: 'Answer',
      qrContent: 'QR content',
      hintCode: 'Clue / code',
    },
    permissions: {
      locationDenied: 'Location permission denied.',
      gpsUnavailable: 'GPS position unavailable.',
      cameraDenied: 'Camera permission denied.',
      micDenied: 'Microphone permission denied.',
    },
    errors: {
      saveFailed: 'Save failed',
      deleteFailed: 'Delete failed',
      operationFailed: 'Operation failed.',
    },
    nav: {
      brand: 'Lootopia',
      links: {
        hunts: 'Hunts',
        dashboard: 'Dashboard',
        settings: 'Settings',
      },
      auth: {
        signIn: 'Sign in',
        getStarted: 'Get started',
      },
      aria: {
        toggleMenu: 'Toggle menu',
      },
    },
    footer: {
      tagline:
        'Real-world treasure hunts with AR, riddles, and adventure. Play in the app — track progress on the web.',
      explore: {
        heading: 'Explore',
        huntCatalog: 'Hunt catalog',
        createAccount: 'Create account',
        dashboard: 'Dashboard',
        settings: 'Settings',
      },
      portals: {
        heading: 'Portals',
        partnerStudio: 'Partner studio',
        adminConsole: 'Admin console',
      },
      copyright: '© {{year}} Lootopia. All rights reserved.',
    },
    home: {
      eyebrow: 'Treasure hunts reimagined',
      headline: 'Find loot. Level up. Explore the world.',
      subhead:
        'Browse hunts on the web, track your stats, and download the app to play with AR, GPS, and live riddles.',
      downloadApp: 'Download app',
      browseHunts: 'Browse hunts',
      features: {
        heading: 'How Lootopia works',
        realWorld: {
          title: 'Real-world adventures',
          description: 'GPS checkpoints and location-based puzzles take you through cities and landmarks.',
        },
        ar: {
          title: 'AR treasure hunts',
          description: 'Discover hidden loot through augmented reality — exclusively in the mobile app.',
        },
        legacy: {
          title: 'Track your legacy',
          description: 'View points, level, and completed hunts on your web dashboard.',
        },
      },
      featured: {
        heading: 'Featured hunts',
        subhead: 'Preview adventures — play them in the app',
        viewAll: 'View all',
        signInPrompt: 'Sign in to preview featured hunts from the catalog.',
        signIn: 'Sign in',
        empty: 'No hunts available yet. Check back soon!',
      },
    },
    dashboard: {
      heading: 'Welcome, {{username}}',
      subhead: 'Your treasure hunting stats',
      settingsLink: 'Settings',
      stats: {
        level: 'Level',
        totalPoints: 'Total points',
        huntsCompleted: 'Hunts completed',
        activeHunts: 'Active hunts',
      },
      profileEmpty: 'Your player profile will appear here once you complete your first hunt in the app.',
      joinedHunts: {
        heading: 'Currently joined',
        badge: '{{count}} in progress',
        inProgress: 'In progress',
        stepMeta: '{{stepCount}} steps · {{duration}}',
        empty: "You haven't joined any hunts yet. Browse the catalog and start one in the app.",
        browseCatalog: 'Browse the catalog',
      },
    },
    settings: {
      heading: 'Account settings',
      signedInAs: 'Signed in as {{username}}',
      roleLinks: {
        adminConsole: 'Admin console',
        partnerStudio: 'Partner studio',
        viewStats: 'View stats',
      },
      signOut: 'Sign out',
      logoutFailed: 'Logout failed',
      activeHunts: {
        heading: 'Active hunts',
        inProgress: 'In progress',
        stepMeta: '{{stepCount}} steps · {{duration}}',
        empty: 'No active hunts. Browse the catalog and start one in the app.',
        browseCatalog: 'Browse the catalog',
      },
    },
    notFound: {
      code: '404',
      heading: 'Lost in the wilderness',
      message: "This page doesn't exist or has been moved.",
      returnHome: 'Return home',
    },
    appDownload: {
      title: 'Play in the Lootopia app',
      description:
        'Treasure hunts are played on mobile with AR, GPS checkpoints, and live riddles. Download the app to start your adventure.',
      downloadApp: 'Download app',
      downloadForAndroid: 'Download for Android',
      directDownloadNote: 'Direct download from our server',
      qr: {
        scanPrompt: 'Scan to download on your phone',
        alt: 'Download QR code',
      },
    },
    tabs: {
      map: 'Map',
      available: 'Available',
      inProgress: 'In progress',
      field: 'Field',
      profile: 'Profile',
    },
    buttons: {
      accept: 'Accept',
      launch: 'Launch',
      play: 'Play',
      resume: 'Resume',
      pause: '⏸ Pause',
      resumeIcon: '▶ Resume',
      signIn: 'Sign in',
      signOut: 'Sign out',
    },
    account: {
      profile: 'Profile',
      level: '⭐ Level {{level}}',
      levelShort: '⭐ Lv. {{level}}',
      xpProgress: '{{points}} / {{target}} XP',
      logout: 'Sign out',
      deleteProfile: 'Delete my profile',
      deleteProfileConfirm:
        '⚠️ Tap again to confirm profile deletion (points and progress will be lost)',
      stats: {
        points: 'Points',
        completedHunts: 'Completed hunts',
        inProgress: 'In progress',
        pointsHud: '{{points}} pts',
      },
    },
    security: {
      title: '🔐 Security',
      loginRequired: 'Sign in to manage your account security.',
      totp: {
        sectionLabel: 'Two-factor authentication (TOTP)',
        status: {
          enabled: '● Enabled',
          disabled: '○ Disabled',
          unknown: '? Unknown',
        },
        enrollInstructions:
          'Add this secret to your authenticator app (Google Authenticator, Authy…) then enter the generated code:',
        disableInstructions: 'Enter a valid TOTP code to confirm deactivation:',
        placeholder: '6-digit code',
        activate: 'Enable TOTP',
        disable: 'Disable',
        disableEllipsis: 'Disable…',
        successEnabled: 'TOTP enabled on your account ✓',
        successDisabled: 'TOTP disabled.',
      },
      passkeys: {
        sectionLabel: 'Registered passkeys',
        listUnavailable: 'List unavailable.',
        empty: 'No passkey. Add one from the website (Settings → Security).',
        defaultName: 'Passkey',
        metaCreated: 'created on {{date}}',
        metaLastUsed: ' · last used on {{date}}',
      },
      web: {
        title: 'Security',
        description: 'Manage two-factor authentication and passkeys for your account.',
        tabs: {
          authenticator: 'Authenticator',
          passkeys: 'Passkeys',
        },
        totp: {
          enable: 'Enable authenticator app',
          qrAlt: 'TOTP QR code',
          verificationCode: 'Verification code',
          placeholder: '000000',
          confirmEnable: 'Confirm & enable',
          disableLabel: 'Disable TOTP (requires current code)',
          disable: 'Disable authenticator',
        },
        passkeys: {
          register: 'Register new passkey',
          defaultName: 'Passkey',
          added: 'Added {{date}}',
        },
        toasts: {
          scanQr: 'Scan the QR code with your authenticator app',
          totpEnrollFailed: 'Failed to start TOTP enrollment',
          twoFactorEnabled: 'Two-factor authentication enabled',
          twoFactorDisabled: 'Two-factor authentication disabled',
          invalidCode: 'Invalid code',
          passkeyRegistered: 'Passkey registered',
          passkeyRegistrationFailed: 'Passkey registration failed',
        },
      },
    },
    map: {
      styles: {
        dark: 'Dark',
        light: 'Light',
        satellite: 'Satellite',
      },
      locationDenied: 'Location denied — enable it in settings to see your position.',
      proximity: {
        title: '🧰 Nearby hunt!',
        body: '"{{huntTitle}}" is within 250 m.',
      },
      sheet: {
        rewardChip: '🏆 {{points}} pts',
        distanceChip: '📍 {{distance}}',
        acceptCta: 'Accept hunt',
        acceptedCta: 'In progress ✓ — view details',
      },
      chaseMap: {
        markerTitle: 'Hunt zone',
        markerDescription: 'Starting point or reference area',
        floatingTitle: 'Hunt map',
        locationActive: 'Your real position is shown on the map.',
        locationLoading: 'Enabling geolocation…',
      },
      playerBadge: {
        you: 'You',
        walking: 'Walking',
      },
      distance: {
        meters: '{{m}} m',
        kilometers: '{{km}} km',
      },
    },
    organizerOnly: {
      fieldTab: 'Organizers only',
      partnerHunts: 'Access restricted to organizers',
    },
    stepsDuration: '{stepCount} steps · {duration}',
    stepsPoints: '{stepCount} steps · {totalPoints} points',
    steps: '{count} steps',
    points: '{points} pts',
    partner: 'Partner: {id}…',
    completed: 'Completed',
    inProgress: 'In progress',
    image: {
      label: 'Image',
      uploaded: 'Image uploaded',
      uploadFailed: 'Upload failed',
      chooseFile: 'Choose file',
      takePhoto: 'Take photo',
      remove: 'Remove image',
      selectedReference: 'Selected image',
      uploading: 'Uploading…',
      takeOrUpload: 'Take a photo or upload from device',
      uploadFromDevice: 'Upload from device',
      processing: 'Processing…',
      uploadImage: 'Upload image',
      previewUnavailable: 'Preview unavailable',
      loadingPreview: 'Loading preview…',
    },
  },

  auth: {
    login: {
      title: 'Sign in',
      description: 'Access your Lootopia dashboard',
      mobileTitle: 'Lootopia Mobile',
      mobileSubtitle: 'Player access for hunts, steps, and your account.',
      fields: {
        email: 'Email',
        password: 'Password',
        authenticatorCode: 'Authenticator code',
        totp: 'TOTP code',
      },
      placeholders: {
        totp: '000000',
      },
      actions: {
        signIn: 'Sign in',
        signInWithPasskey: 'Sign in with passkey',
        signInWithPasskeyMobile: '🔑 Sign in with a passkey',
        verify: 'Verify',
        validateCode: 'Validate code',
        back: 'Back',
        backToCredentials: 'Back to credentials',
        resendVerification: 'Resend verification link',
      },
      links: {
        forgotPassword: 'Forgot password?',
        noAccount: 'No account?',
        register: 'Register',
        createAccount: 'Create an account',
      },
      passkeyHint:
        'Opens in the browser: your Lootopia site passkey (Face ID / fingerprint) signs you back in here automatically.',
      info: {
        mfaRequired: 'Enter your authenticator code to continue',
        totpRequired: 'A TOTP code is required to complete sign-in.',
        passkeyRequired: 'A passkey is required for this account — use the passkey button below.',
        passkeyMfaRequired: 'This sign-in requires a passkey — use the button below.',
        verificationSent: 'A new verification link has been sent.',
      },
      toasts: {
        welcomeBack: 'Welcome back!',
        loginFailed: 'Login failed',
        invalidCode: 'Invalid code',
        enterEmailFirst: 'Enter your email first',
        signedInWithPasskey: 'Signed in with passkey',
        passkeyLoginFailed: 'Passkey login failed',
      },
      errors: {
        emailNotVerified: 'Your email is not verified yet.',
        invalidCredentials: 'Sign-in failed. Check your credentials.',
        generic: 'Sign-in failed. Try again later.',
        resendFailed: 'Could not resend verification link.',
        passkeyBrowserFailed: 'Could not open browser for passkey sign-in.',
      },
    },
    register: {
      title: 'Create account',
      mobileTitle: 'Create a player account',
      description: 'Join Lootopia and start your adventure',
      fields: {
        username: 'Username',
        email: 'Email',
        password: 'Password',
        bioOptional: 'Bio (optional)',
        bio: 'Bio (optional)',
        avatarUrl: 'Avatar URL (optional)',
      },
      actions: {
        createAccount: 'Create account',
        createMyAccount: 'Create my account',
      },
      links: {
        alreadyHaveAccount: 'Already have an account?',
        signIn: 'Sign in',
        haveAccount: 'I already have an account',
      },
      success: {
        title: 'Verify your email',
        description:
          'We sent a verification link to your inbox. Click it to activate your account, then sign in.',
        goToSignIn: 'Go to sign in',
        mobile: 'Account created. Verify your email to activate access.',
      },
      toasts: {
        checkEmail: 'Check your email to verify your account',
        registrationFailed: 'Registration failed',
      },
      errors: {
        usernameRequired: 'Choose a username.',
        createFailed: 'Could not create account.',
      },
    },
    verify: {
      loading: 'Verifying email…',
      successTitle: 'Email verified!',
      errorTitle: 'Verification failed',
      successDescription: 'Your account is ready. Sign in to continue.',
      errorDescription: 'The link may be invalid or expired.',
      signIn: 'Sign in',
      toast: 'Email verified!',
    },
    forgotPassword: {
      title: 'Reset password',
      mobileTitle: 'Forgot password',
      description: 'Enter your email and we will send you a reset link.',
      mobileSubtitle: "Enter your email: we'll send you a one-time reset link.",
      fields: { email: 'Email' },
      actions: {
        sendResetLink: 'Send reset link',
        sendLink: 'Send link',
      },
      sent: {
        title: '📬 Sent',
        description:
          'If an account exists for this address, a one-time reset link has just been sent. Open it on your phone, or enter the code you received:',
        cta: 'I received my code',
        default: 'Check your email for a reset link.',
      },
      links: { backToSignIn: 'Back to sign in' },
      toasts: {
        resetLinkSent: 'If an account exists, a reset link has been sent',
        requestFailed: 'Request failed',
      },
    },
    resetPassword: {
      title: 'Set new password',
      mobileTitle: 'New password',
      description: 'Choose a strong new password for your account.',
      mobileSubtitle:
        'Paste the code from your email (or open the link on this phone), then choose a new password.',
      fields: {
        resetToken: 'Reset token',
        token: 'Reset code',
        newPassword: 'New password',
        confirm: 'Confirm password',
      },
      actions: { updatePassword: 'Update password', reset: 'Reset' },
      note: 'All existing sessions will be signed out.',
      links: { backToSignIn: 'Back to sign in' },
      toasts: {
        passwordUpdated: 'Password updated. Please sign in.',
        resetFailed: 'Reset failed',
      },
    },
    mobile: {
      title: 'Mobile app sign-in',
      description: 'Authenticate with your passkey to return to the Lootopia app.',
      invalidRedirect: {
        error: 'Invalid or missing redirect link.',
        hint: 'This page must be opened from the Lootopia mobile app.',
      },
      redirecting: 'Returning to the app…',
      continueAs: 'Continue as {{username}}',
      orPasskey: 'or sign in with a passkey',
      fields: { email: 'Email' },
      placeholders: { email: 'you@example.com' },
      actions: {
        connecting: 'Connecting…',
        signInWithPasskey: 'Sign in with a passkey',
        cancel: 'Cancel and return to app',
      },
      errors: {
        emailRequired: 'Enter your email to continue.',
        passkeyFailed: 'Passkey sign-in failed.',
      },
    },
    callback: {
      loading: 'Passkey sign-in in progress…',
      failedTitle: 'Sign-in failed',
      backToLogin: 'Back to sign in',
      errors: {
        webFailed: 'Passkey sign-in failed on the web side.',
        missingToken: 'Invalid sign-in link (missing token).',
        invalidToken: 'Invalid or expired sign-in token.',
      },
    },
    profile: {
      title: 'Profile',
      description: 'Update your avatar and bio. Images are stored in object storage.',
      avatar: {
        label: 'Avatar',
        description: 'Upload a profile photo. It will be saved to S3-compatible storage.',
        alt: 'Avatar',
      },
      fields: { bio: 'Bio' },
      placeholders: { bio: 'Tell other hunters a little about yourself' },
      actions: {
        saving: 'Saving…',
        saveProfile: 'Save profile',
      },
      toasts: {
        profileUpdated: 'Profile updated',
        updateFailed: 'Failed to update profile',
      },
    },
  },

  hunts: {
    shared: {
      difficulties: {
        all: 'All',
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
      },
      difficultyLabels: {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
      },
      statusLabels: {
        draft: 'Upcoming',
        active: 'Active',
        paused: 'Paused',
        archived: 'Archived',
      },
      statusSelect: {
        draft: 'Draft',
        active: 'Active',
        paused: 'Paused',
        archived: 'Archived',
      },
      duration: {
        minutes: '{{minutes}} min',
        hoursMinutes: '{{hours}}h {{minutes}}m',
        hoursOnly: '{{hours}}h',
      },
      points: {
        short: '{{points}} pts',
        awarded: 'Awarded when players complete this step',
      },
      pause: {
        pauseHunt: 'Pause hunt',
        resumeHunt: 'Resume hunt',
        pause: 'Pause',
        resume: 'Resume',
        pausedMessage: 'This hunt is currently paused. Gameplay is temporarily unavailable.',
        toasts: {
          paused: 'Hunt paused',
          resumed: 'Hunt resumed',
          failedPause: 'Failed to pause hunt',
          failedResume: 'Failed to resume hunt',
          statusUpdateFailed: 'Status update failed',
        },
      },
      delete: {
        confirm: 'Delete "{{title}}"?',
        confirmPermanent: 'Delete "{{title}}"? This cannot be undone.',
        deleted: 'Hunt deleted',
        deleteFailed: 'Delete failed',
      },
      status: {
        inProgress: 'In progress',
        paused: 'Paused',
        pausedByOrganizer: '⛔ Suspended by organizer',
        completed: ' · Completed 🎉',
      },
      meta: {
        stepsAndDuration: '{{count}} steps · {{minutes}} min',
        stepProgress: 'Step {{current}}/{{total}}',
        stepProgressWithTitle: 'Step {{current}}/{{total}} · {{stepTitle}}',
        detailDifficulty: 'Difficulty: {{difficulty}}',
        detailDuration: 'Duration: {{minutes}} min',
        detailOrganizer: 'Organizer: {{name}}',
        progressCounter: '{{current}} / {{total}}',
      },
      sections: {
        detail: 'Details',
        map: 'Map',
        steps: 'Steps',
      },
      abandon: 'Abandon hunt',
      errors: {
        notFound: 'Hunt not found',
        stepNotFound: 'Step not found',
        missingCoordinates: 'Missing coordinates',
        startFailed: 'Could not start',
        loadFailed: 'Could not load',
        notAuthenticated: 'Sign in to join hunts',
        playerOnlyJoin: 'Only player accounts can join hunts',
        joinFailed: 'Could not join hunt',
        leaveFailed: 'Could not leave hunt',
      },
    },
    stepTypes: {
      checkpoint: 'GPS checkpoint',
      riddle: 'Riddle',
      qr_code: 'QR code',
      clue: 'Clue',
      ar: 'AR treasure',
      photo: 'Photo',
    },
    stepTypeOptions: {
      checkpoint: {
        label: 'Checkpoint (GPS)',
        description: 'Players must physically reach this location',
      },
      riddle: {
        label: 'Riddle',
        description: 'Solve a riddle when arriving at this location',
      },
      qr_code: {
        label: 'QR Code',
        description: 'Scan a QR code placed at this location',
      },
      clue: {
        label: 'Clue',
        description: 'Discover a clue hidden at this location',
      },
      ar: {
        label: 'AR Treasure',
        description: 'Reveal augmented-reality loot at this location in the app',
      },
      photo: {
        label: 'Photo match',
        description: 'Players take a matching photo at this location to complete the step',
      },
    },
    stepActions: {
      checkpoint: 'Go there',
      riddle: 'Answer',
      qr_code: 'Scan',
      clue: 'Discover',
      ar: 'Open AR',
      photo: 'Take photo',
      default: 'Start',
    },
    liveEvents: {
      huntSuspendedTitle: 'Hunt suspended',
    },
    catalog: {
      heading: 'Hunt catalog',
      catalogAccent: 'catalog',
      pageHeading: 'Hunts',
      subhead: 'Preview available treasure hunts. Download the app to play.',
      searchPlaceholder: 'Search hunts…',
      guest: {
        heading: 'Hunt catalog',
        message: 'Sign in to browse available treasure hunts. Download the app to play.',
        signIn: 'Sign in to browse',
      },
      empty: 'No hunts match your filters.',
      mobileEmpty: 'No hunts',
      badgeInProgress: 'In progress',
      errors: { loadFailed: 'Unable to load hunts. Please try again later.' },
    },
    list: {
      heading: 'In progress',
      empty: {
        title: 'No hunt in progress',
        cta: 'Browse hunts',
      },
    },
    detail: {
      signInPrompt: 'Sign in to view hunt details.',
      signIn: 'Sign in',
      notFound: 'Hunt not found or unavailable.',
      backToCatalog: 'Back to catalog',
      bannerInProgress: 'In progress',
      primaryAction: {
        launch: 'Launch',
        continue: 'Continue',
      },
      heatmap: {
        title: 'Player activity heatmap',
        legend: {
          stepCompletions: 'Step completions (size = popularity)',
          recentLocations: 'Recent player locations',
        },
        stats: '{{participantCount}} participants · {{completedCount}} finished',
        topSteps: '{{order}}. {{title}}',
        visits: '{{count}} visits',
        empty: 'No location data yet — completions will appear here as players progress.',
        tooltip: {
          recentPlayer: 'Recent player location',
          completions: '{{count}} completion{{suffix}}',
        },
      },
      steps: {
        title: 'Steps ({{count}})',
        participantsLabel: 'Participants',
      },
      sidebar: {
        stepMeta: '{{stepCount}} steps · {{totalPoints}} points',
        downloadToPlay: 'Download app to play',
        requiresApp: 'Gameplay requires the Lootopia mobile app',
      },
      downloadBanner: {
        title: 'Ready to hunt?',
        description:
          'This adventure is waiting for you in the Lootopia app. GPS, AR, and riddles come alive on mobile.',
      },
    },
    cards: {
      partnerPrefix: 'Partner: {{partnerIdPrefix}}…',
      viewDetails: 'View details',
    },
    participants: {
      title: 'Participants ({{count}})',
      joined: 'Joined {{date}}',
      status: {
        completed: 'Completed',
        inProgress: 'In progress',
      },
      points: '{{points}} pts',
      loadFailed: 'Unable to load participants.',
      empty: 'No participants yet.',
    },
    wizard: {
      pages: {
        create: {
          back: 'Back to studio',
          heading: 'Create new hunt',
        },
        edit: {
          back: 'Back to studio',
          heading: 'Edit hunt',
          notFound: 'Hunt not found.',
        },
      },
      steps: {
        basics: 'Basics',
        steps: 'Steps',
        review: 'Review',
      },
      basics: {
        title: 'Hunt basics',
        fields: {
          title: 'Title',
          description: 'Description',
          coverImage: 'Cover image',
          coverImageDescription: 'Upload an image for the hunt card and detail page.',
          difficulty: 'Difficulty',
          durationMin: 'Duration (min)',
          status: 'Status',
          partnerId: 'Partner ID',
        },
      },
      stepEditor: {
        stepTitle: 'Step {{number}}',
        aria: {
          moveUp: 'Move step up',
          moveDown: 'Move step down',
        },
        fields: {
          type: 'Type',
          title: 'Title',
          points: 'Points',
          description: 'Description',
          answer: 'Answer',
        },
        answerPlaceholder: 'Clue, code, riddle solution, QR payload, or any verification value',
        answerHint: 'Optional verification value used across all step types.',
        addStep: 'Add step',
      },
      location: {
        heading: 'Location',
        address: 'Address',
        addressPlaceholder: 'e.g. 1 Market St, San Francisco, CA',
        lookup: 'Look up',
        lookingUp: 'Looking up…',
        hint: 'Enter an address to fetch coordinates, or fine-tune by clicking the map.',
        toasts: {
          enterAddress: 'Enter an address first',
          found: 'Location found',
          lookupFailed: 'Address lookup failed',
          geocodeFailed: 'Failed to look up address',
        },
      },
      photoCapture: {
        heading: 'Capture on your phone',
        description:
          'Open Lootopia Mobile on your phone, scan the QR code, and take the reference photo on-site. It will appear here automatically.',
        referencePhoto: {
          label: 'Reference photo',
          description: 'Take a photo on-site or upload a reference image players must match.',
        },
        actions: {
          starting: 'Starting…',
          usePhoneCamera: 'Use phone camera',
          cancelCapture: 'Cancel capture',
          startNewCapture: 'Start a new capture',
        },
        status: {
          waiting: 'Waiting for photo from your phone…',
          received: 'Photo received from your phone.',
        },
        qr: {
          alt: 'QR code to open mobile capture',
          expoHint: 'Expo Go link (scan with your phone camera):',
          signInHint: 'Sign in on mobile with the same partner account, then scan this QR or open:',
        },
        errors: {
          startFailed: 'Could not start mobile capture',
          refreshFailed: 'Could not refresh capture session',
          sessionExpired: 'Session expired — sign in again on web and start a new capture.',
        },
        captureRedirect: {
          invalidTitle: 'Invalid capture link',
          invalidMessage: 'Start a new capture from the hunt wizard on web.',
          expoTitle: 'Open in Expo Go',
          expoMessage:
            'Open Lootopia Mobile in Expo Go first (same tunnel), then tap the button below. Sign in with your partner account before taking the photo.',
          openCapture: 'Open capture in Lootopia Mobile',
        },
      },
      arPreview: {
        message: 'AR preview — players will discover this treasure at the mapped location in the mobile app.',
      },
      review: {
        title: 'Review & publish',
        badges: {
          steps: '{{count}} steps',
          totalPoints: '{{totalPoints}} total points',
        },
        stepLine: '{{number}}. {{title}} ({{stepType}}) · {{points}} pts',
        referencePhotoAttached: 'Reference photo attached',
        answer: 'Answer: {{answer}}',
        referencePhotoAlt: 'Reference photo',
      },
      navigation: {
        back: 'Back',
        next: 'Next',
        createHunt: 'Create hunt',
        saveChanges: 'Save changes',
      },
      toasts: {
        created: 'Hunt created!',
        updated: 'Hunt updated!',
        saveFailed: 'Failed to save hunt',
        fixFields: 'Please fix the highlighted fields',
        completeSteps: 'Please complete all hunt steps',
      },
    },
    editor: {
      note: 'Mobile partner hunt editor (distinct from web wizard)',
    },
    imagePicker: {
      defaultLabel: 'Image',
      emptyWithCamera: 'Take a photo or upload from your device',
      emptyUpload: 'Upload an image from your device',
      uploading: 'Uploading…',
      processing: 'Processing…',
      takePhoto: 'Take photo',
      uploadImage: 'Upload image',
      selectedAlt: 'Selected reference',
      preview: {
        unavailable: 'Preview unavailable',
        loading: 'Loading preview…',
      },
      toasts: {
        uploaded: 'Image uploaded',
        uploadFailed: 'Image upload failed',
      },
    },
    ar: {
      permission: {
        title: 'Mobile AR',
        body: 'Allow camera access to enable the hunt AR experience.',
        button: 'Allow camera',
      },
      kicker: 'AR EXPERIENCE',
      title: 'Augmented reality clue',
      live: {
        huntPaused: 'Hunt suspended',
        stepPaused: 'Step suspended',
        pausedByOrganizer: '⛔ {{scope}} by organizer',
        redirect: '📍 Step moved by organizer{{note}}',
      },
      clues: {
        photoLocked: 'Photo clue within {{meters}} m',
        audioButton: '🔊 Audio clue',
      },
      status: {
        distance: 'Position: {{distance}} m from point',
        geoUnavailable: 'Geolocation unavailable',
      },
      helperDefault: 'Get closer to the point — or scan the step QR code with the camera.',
      validateButton: {
        validated: 'Step validated ✓',
        ready: 'Validate step',
        blocked: 'Validation blocked',
      },
      messages: {
        stepSuspended: '⛔ Step suspended by organizer — try again later.',
        tooFar: 'You must be near the point (or scan its QR code) before validating.',
        validatedChest: 'Step validated — the chest is yours!',
        qrRecognizedGuardian: 'QR code recognized — but a guardian protects the chest!',
        qrValidated: 'QR code recognized — step validated!',
        qrUnknown: 'Unknown QR code for this step.',
        guardianDefeated: 'Guardian defeated — step validated, the chest is yours!',
        pointsEarned: '+{{points}} pts',
        huntCompleted: 'Hunt complete!',
      },
      answerInput: {
        riddlePlaceholder: 'Answer',
        cluePlaceholder: 'Clue / code',
      },
    },
    combat: {
      title: 'Guardian combat',
      hp: { guardian: 'Guardian', you: 'You' },
      messages: {
        intro: 'A guardian protects the chest!',
        hit: 'Hit! The guardian staggers…',
        miss: 'Miss! The guardian counterattacks.',
        guardianWins: 'The guardian pushed you back…',
        playerWins: 'Guardian defeated! The chest is yours.',
        retryIntro: 'The guardian rises again — your turn!',
      },
      buttons: {
        strike: '⚔️ Strike!',
        flee: 'Flee combat',
        openChest: 'Open the chest 🪙',
        retry: 'Retry',
        giveUp: 'Give up',
      },
    },
    stepAnswer: {
      defaultPlaceholder: 'Answer',
      validated: 'Validated ✓',
      errorIncorrect: 'Incorrect answer',
    },
    stepPhoto: {
      takePhoto: 'Take a photo',
      retake: 'Retake',
      send: 'Send',
      capture: 'Capture',
      validated: 'Step validated ✓',
      errors: {
        cameraDenied: 'Camera permission denied.',
        captureFailed: 'Capture failed',
        notRecognized: 'Photo not recognized',
      },
    },
    capture: {
      loginRequired: {
        title: 'Sign-in required',
        body: 'Sign in with your partner account to send the reference photo.',
      },
      invalidLink: {
        title: 'Invalid link',
        body: 'Scan the QR code from the web wizard.',
      },
      overlay: {
        title: 'Reference photo',
        hintCapture: 'Frame the clue on site, then take the photo.',
        hintReview: 'Review the photo then send it to the web wizard.',
      },
      errors: {
        cameraDenied: 'Camera permission denied.',
        captureFailed: 'Capture failed, try again.',
        uploadFailed: 'Upload failed.',
        wrongAccount: 'Sign in with the same partner account as on the web.',
        sessionExpired: 'Session expired — restart capture from the web wizard.',
      },
    },
  },

  admin: {
    console: {
      heading: 'Admin console',
      subhead: 'Platform overview and management',
      cards: {
        playerProfiles: 'Player profiles',
        treasureHunts: 'Treasure hunts',
        viewAllProfiles: 'View all profiles →',
        manageHunts: 'Manage hunts →',
      },
      quickLinks: {
        profiles: 'Profiles',
        hunts: 'Hunts',
        createHunt: 'Create hunt',
      },
    },
    profiles: {
      back: 'Back to admin',
      heading: 'Player profiles',
      tableTitle: 'All profiles ({{count}})',
      columns: {
        username: 'Username',
        email: 'Email',
        points: 'Points',
        level: 'Level',
        completed: 'Completed',
        actions: 'Actions',
      },
      empty: 'No profiles yet.',
      toasts: {
        invalidNumbers: 'Enter valid numbers for points, level, and completed hunts.',
        updated: 'Profile updated',
        updateFailed: 'Failed to update profile',
      },
    },
    hunts: {
      back: 'Back to admin',
      heading: 'Manage hunts',
      createHunt: 'Create hunt',
      tableTitle: 'All hunts ({{count}})',
      meta: '{{stepCount}} steps · {{duration}} · Partner {{partnerIdPrefix}}…',
      actions: {
        edit: 'Edit',
        delete: 'Delete',
      },
      empty: 'No hunts yet.',
    },
  },

  partner: {
    studio: {
      heading: 'Partner studio',
      subhead: 'Create and manage your treasure hunts',
      newHunt: 'New hunt',
      empty: 'No hunts yet. Create your first adventure!',
      createHunt: 'Create hunt',
      tooltips: {
        resumeHunt: 'Resume hunt',
        pauseHunt: 'Pause hunt',
      },
    },
    editor: {
      newHunt: 'New hunt',
      editHunt: 'Edit',
      huntSection: 'Hunt',
      difficulty: 'Difficulty',
      durationMinutes: 'Duration (min)',
      status: 'Status',
      stepsSection: 'Steps ({{count}})',
      addStep: '+ Add',
      currentLocation: '📍 Current location',
      points: 'Points',
      deleteHunt: 'Delete hunt',
      deleteConfirmTitle: 'Delete',
      deleteConfirmMessage: 'This hunt will be permanently deleted.',
      photoReference: {
        hint: 'Reference photo required',
        capture: 'Capture',
        retake: 'Retake',
        errors: {
          cameraDenied: 'Camera permission denied.',
          captureFailed: 'Capture failed',
          uploadFailed: 'Upload failed',
        },
      },
    },
    hunts: {
      header: 'My hunts',
      empty: 'No hunts',
      untitled: 'Untitled',
      status: {
        active: 'Active',
        draft: 'Draft',
        paused: 'Paused',
      },
      cardMeta: '{{stepCount}} step{{suffix}} · {{status}}',
      editLoadError: 'Hunt not found',
    },
    field: {
      header: 'Field',
      segments: {
        creation: 'Creation',
        liveops: 'Live ops',
        heatmap: 'Heatmap',
      },
      creation: {
        myHunts: 'My hunts',
        newHuntHere: 'New hunt here',
        errors: {
          locationDenied: 'Location permission denied.',
          gpsUnavailable: 'GPS position unavailable.',
        },
      },
      liveops: {
        empty: 'No hunts',
        meta: '{{stepCount}} step{{suffix}} · {{participants}} participants',
        huntPause: {
          suspend: 'Suspend',
          resume: 'Resume',
          badge: 'Paused',
        },
        expandSteps: {
          show: 'Steps ▼',
          hide: 'Hide ▲',
        },
        stepActions: {
          suspend: 'Suspend',
          resume: 'Resume',
          cancelRedirect: 'Cancel',
          redirectHere: 'Redirect here',
        },
        redirectLabel: '→ {{lat}},{{lng}}',
        errors: {
          modifyFailed: 'Could not apply change.',
          locationDenied: 'Location permission denied.',
          gpsUnavailable: 'GPS position unavailable.',
        },
      },
      heatmap: {
        stats: {
          cells: 'Cells',
          points: 'Points',
        },
        empty: 'No data',
        clear: 'Clear',
      },
      photoClueCapture: {
        buttonNew: '📷 Secret photo',
        buttonRetake: '📷 Retake secret photo',
        errors: {
          cameraDenied: 'Camera permission denied.',
          locationDenied: 'Location permission denied.',
          tooFar: 'Get within 15 m of the point (you are {{distance}} away).',
          gpsUnavailable: 'GPS unavailable — try again outdoors.',
          captureFailed: 'Capture failed, try again.',
        },
      },
      audioHintRecorder: {
        recordNew: '🎙 10 s audio clue',
        rerecord: "🎙 Re-record audio clue",
        stop: '■ Stop',
        recIndicator: '● REC 0:{{seconds}}',
        listen: '▶ Listen',
        errors: {
          micDenied: 'Microphone permission denied.',
          startFailed: 'Could not start recording.',
          recordFailed: 'Recording failed.',
        },
      },
    },
  },

  validation: {
    huntTitleMin: 'Title: minimum 3 characters',
    huntDescriptionMin: 'Description: minimum 10 characters',
    huntStepsRequired: 'Add at least one step',
    stepTitleRequired: 'Step {{index}}: title required',
    stepDescriptionRequired: 'Step {{index}}: description required',
    stepCoordinatesRequired: 'Step {{index}}: coordinates required',
    stepPhotoReferenceRequired: 'Step {{index}}: reference photo required',
    hunt: {
      basics: {
        titleMin: 'Title must be at least 3 characters',
        descriptionMin: 'Description must be at least 10 characters',
        imageInvalid: 'Upload an image or provide a valid image URL',
        partnerIdRequired: 'Partner ID is required',
      },
      step: {
        titleRequired: 'Title is required',
        descriptionRequired: 'Description is required',
        pointsInvalidType: 'Points are required',
        pointsMin: 'Points must be at least 1',
        locationRequired: 'Set a location using the address lookup or map',
        photoAnswerRequired: 'Add a reference photo for players to match',
      },
      form: {
        stepsMin: 'At least one step is required',
      },
      wizard: {
        stepsMin: 'At least one step is required',
      },
    },
    auth: {
      login: {
        emailInvalid: 'Invalid email',
        passwordMin: 'Password must be at least 8 characters',
      },
      register: {
        usernameMin: 'Username must be at least 3 characters',
        emailInvalid: 'Invalid email',
        passwordMin: 'Password must be at least 8 characters',
        usernameRequired: 'Choose a username.',
      },
      totp: {
        codeLength: 'Code must be 6 digits',
      },
      resetPassword: {
        newPasswordMin: 'Password must be at least 8 characters',
        passwordMinLength: 'Password must be at least 8 characters.',
        passwordMismatch: 'The two passwords do not match.',
        invalidToken: 'Invalid or expired link. Request a new reset email.',
        genericFailed: 'Reset failed. Try again later.',
      },
      forgotPassword: {
        emailInvalid: 'Invalid email',
      },
    },
    stepAnswer: {
      incorrect: 'Incorrect answer',
    },
    stepPhoto: {
      notRecognized: 'Photo not recognized',
    },
  },
};

const enMerged = deepMerge(JSON.parse(JSON.stringify(en)), mobileKeys);
enMerged.common.localeSwitcher = { label: 'Language', en: 'English', fr: 'Français' };
enMerged.common.language = 'Language';

const fr = deepMerge(
  deepMerge(deepMerge(JSON.parse(JSON.stringify(enMerged)), frOverridesCommon), frOverridesRest),
  mobileKeysFr,
);
fr.common.localeSwitcher = { label: 'Langue', en: 'English', fr: 'Français' };
fr.common.language = 'Langue';

const namespaces = ['common', 'auth', 'hunts', 'admin', 'partner', 'validation'];
for (const locale of ['en', 'fr']) {
  const data = locale === 'en' ? enMerged : fr;
  for (const ns of namespaces) {
    const path = join(root, locale, `${ns}.json`);
    writeFileSync(path, JSON.stringify(normalizeInterpolation(data[ns]), null, 2) + '\n');
  }
}

console.log('Wrote', namespaces.length * 2, 'locale files');
