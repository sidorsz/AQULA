document.addEventListener('DOMContentLoaded', () => {
    // Wait until the Supabase client and user ID are confirmed to be available.
    // This is a simple check; you might have a more robust system (e.g., events, promises).
    const initializeInterval = setInterval(() => {
        if (typeof supabase !== 'undefined' && typeof loggedInUserId !== 'undefined' && loggedInUserId) {
            clearInterval(initializeInterval);
            setupAccessTokenRedemption();
        }
    }, 500);
});


/**
 * Sets up the event listeners and logic for the access token redemption form.
 */
function setupAccessTokenRedemption() {
    const tokenInput = document.getElementById('accessTokenInput');
    const redeemBtn = document.getElementById('redeemAccessTokenBtn');
    const pasteBtn = document.getElementById('pasteAccessTokenBtn'); // New Paste Button

    if (!tokenInput || !redeemBtn || !pasteBtn) {
        console.error('Access token redemption elements (input, redeem, or paste button) not found in the DOM.');
        return;
    }

    // NEW: Event listener for the Paste button
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                tokenInput.value = text;
                // Manually trigger the 'input' event to apply the auto-formatting logic
                tokenInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            showToast('Error', 'Could not paste from clipboard. Please paste manually.', 'destructive');
        }
    });
    
    // UPDATED: More robust event listener for real-time formatting.
    tokenInput.addEventListener('input', (e) => {
        const target = e.target;
        const originalValue = target.value;
        const cursorPosition = target.selectionStart;

        // Count hyphens before formatting to track changes
        const oldHyphenCount = (originalValue.match(/-/g) || []).length;
        
        // Clean the input value
        let value = originalValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Enforce a maximum of 12 alphanumeric characters (replaces HTML maxlength)
        if (value.length > 12) {
            value = value.substring(0, 12);
        }

        // Add hyphens to create the XXXX-XXXX-XXXX format
        const formattedValue = (value.match(/.{1,4}/g) || []).join('-');
        
        // Count hyphens after formatting
        const newHyphenCount = (formattedValue.match(/-/g) || []).length;

        // Update the input value
        target.value = formattedValue;
        
        // Calculate the new cursor position intelligently
        const cursorAdjustment = newHyphenCount - oldHyphenCount;
        let newCursorPosition = cursorPosition + cursorAdjustment;
        
        // BUG FIX: Ensure the new cursor position is not out of bounds of the new value's length.
        // This prevents errors when the script shortens the input (e.g., on the 13th character).
        if (newCursorPosition > formattedValue.length) {
            newCursorPosition = formattedValue.length;
        }

        // Restore the cursor position, ensuring it's valid
        target.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    redeemBtn.addEventListener('click', async () => {
        const enteredToken = tokenInput.value.trim().toUpperCase();

        // 1. Updated client-side validation for XXXX-XXXX-XXXX format
        if (enteredToken.length !== 14) {
            showToast('Warning', 'Please use the format: XXXX-XXXX-XXXX.', 'warning');
            return;
        }

        // Remove hyphens for database query (this logic remains the same)
        const tokenForDb = enteredToken.replace(/-/g, '');

        // Final check to ensure we have 12 characters after stripping hyphens
        if (tokenForDb.length !== 12) {
            showToast('Error', 'Invalid token format.', 'destructive');
            return;
        }

        redeemBtn.disabled = true;
        redeemBtn.querySelector('span').textContent = 'Checking...';

        try {
            // 2. Check if the token is valid using the cleaned 12-character token
            const { data: tokenData, error: tokenError } = await supabase
                .from('access_tokens')
                .select('id')
                .eq('token', tokenForDb) // Use token without hyphens
                .single();

            if (tokenError || !tokenData) {
                showToast('Error', 'Invalid or incorrect access token.', 'destructive');
                tokenInput.value = ''; // Clear input on failure
                return;
            }

            const tokenId = tokenData.id;

            // 3. Check if the current user has already redeemed this specific token
            const { data: redeemedData, error: redeemedError } = await supabase
                .from('redeemed_tokens')
                .select('id')
                .eq('user_id', loggedInUserId)
                .eq('token_id', tokenId)
                .maybeSingle();

            if (redeemedError) {
                showToast('Error', 'Failed to verify token status. Please try again.', 'destructive');
                return;
            }

            if (redeemedData) {
                showToast('Warning', 'You have already redeemed this token.', 'warning');
                tokenInput.value = '';
                return;
            }
            
            // 4. If token is valid and not redeemed, fetch current points and add the reward
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('points')
                .eq('id', loggedInUserId)
                .single();
            
            if (profileError || !profileData) {
                 showToast('Error', 'Could not find your profile to add points.', 'destructive');
                 return;
            }

            const currentPoints = profileData.points || 0;
            const rewardAmount = 500;
            const newPoints = currentPoints + rewardAmount;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ points: newPoints })
                .eq('id', loggedInUserId);

            if (updateError) {
                showToast('Error', 'Failed to update your points.', 'destructive');
                return;
            }

            // 5. Record the redemption to prevent reuse
            const { error: insertError } = await supabase
                .from('redeemed_tokens')
                .insert({
                    user_id: loggedInUserId,
                    token_id: tokenId
                });
            
            if (insertError) {
                 // The user got the points, but we failed to log it. This is a critical state.
                 // In a production app, you might want more complex handling here.
                 console.error("CRITICAL: Failed to record token redemption after awarding points.", insertError);
            }

            // --- PERBAIKAN UTAMA: KIRIM SINYAL KE MINING SYSTEM ---
            // Memberi tahu sistem mining untuk mengupdate poin lokalnya
            const syncEvent = new CustomEvent('pointsUpdatedFromTask', { 
                detail: { newPoints: newPoints } 
            });
            window.dispatchEvent(syncEvent);
            // -----------------------------------------------------

            showToast('Success', `Token redeemed! You received ${rewardAmount} points.`, 'success');
            tokenInput.value = ''; // Clear input after success

            // Optionally, update the points display on the UI immediately
            const pointsDisplay = document.getElementById('currentPoints');
            if (pointsDisplay) {
                pointsDisplay.innerHTML = `
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="http://www.w3.org/2000/svg" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                 </svg>
                 ${newPoints.toLocaleString()}
                `;
            }

        } catch (error) {
            console.error('An error occurred during token redemption:', error);
            showToast('Error', 'An unexpected error occurred. Please try again.', 'destructive');
        } finally {
            // 6. Reset the button state
            redeemBtn.disabled = false;
            redeemBtn.querySelector('span').textContent = 'Redeem';
        }
    });
}

/**
 * Placeholder for your toast notification function.
 * @param {string} title - The title of the toast.
 * @param {string} message - The main message of the toast.
 * @param {string} type - The type of toast ('success', 'warning', 'destructive', 'default').
 */
function showToast(title, message, type = 'default') {
    // Replace this with your actual toast notification library or implementation.
    console.log(`[TOAST - ${type.toUpperCase()}] ${title}: ${message}`);
    
    // Example of creating a simple toast element for demonstration
    const toastContainer = document.getElementById('toast-container') || document.createElement('div');
    if (!toastContainer.id) {
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '1000';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    const colorMap = {
        success: '#22c55e',
        warning: '#f59e0b',
        destructive: '#ef4444',
        default: '#3b82f6'
    };
    
    toast.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.marginBottom = '10px';
    toast.style.borderLeft = `4px solid ${colorMap[type]}`;
    toast.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    toast.innerHTML = `<strong style="display: block; font-size: 14px; margin-bottom: 4px;">${title}</strong><span style="font-size: 12px;">${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}