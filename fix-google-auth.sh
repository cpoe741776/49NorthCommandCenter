#!/bin/bash
# Script to update all functions to use shared Google auth helper

echo "Updating functions to use shared Google auth..."

# List of functions that need fixing (excluding ones already using _utils/google properly)
FUNCTIONS=(
  "getWebinars.js"
  "getSocialMediaContent.js"
  "getBids.js"
  "updateBidStatus.js"
  "deleteBidSystem.js"
  "updateBidSystem.js"
  "updateSystemAdminStatus.js"
  "reviveDisregardedEmail.js"
  "getSystemAdminEmails.js"
  "getDisregardedEmails.js"
  "getCommodityCodes.js"
  "getBidSystems.js"
  "addBidSystem.js"
  "createSocialPost.js"
  "listSheetTabs.js"
  "getCompanyData.js"
)

echo "Functions to update: ${#FUNCTIONS[@]}"
for func in "${FUNCTIONS[@]}"; do
  echo "  - $func"
done

echo ""
echo "This would require manual updates to each file."
echo "Better approach: Update _utils/google.js to be the single source of truth."

