# Extract the zip, then:
cd vibecall-mobile
npm install
npx expo start
npm install -g eas-cli
eas login
# iOS — uploads to TestFlight automatically
eas build --platform ios --profile production

# Android — downloads .aab for Play Store upload
eas build --platform android --profile production
