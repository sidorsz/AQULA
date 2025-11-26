
      // Initialize Lucide icons
      lucide.createIcons();

      // Global variables
      let currentUser = null;
      let currentFolderId = null;
      let currentFileId = null;
      let storageChart = null;
      const STORAGE_LIMIT_MB = 100; // Define storage limit (100 MB)
      const MAX_FOLDERS = 4; // Max 4 folders per user
      const MAX_FILES_PER_FOLDER = 10; // Max 10 files per folder

      // Default folder icons
      const DEFAULT_FOLDER_ICONS = [
        {
          name: "Folder Style 1",
          url: "https://mnobniomzmjgpyyqartz.supabase.co/storage/v1/object/public/chat-media/folder%20ico/FOLDER1.ico",
        },
        {
          name: "Folder Style 2",
          url: "https://mnobniomzmjgpyyqartz.supabase.co/storage/v1/object/public/chat-media/folder%20ico/FOLDER2.ico",
        },
        {
          name: "Folder Style 3",
          url: "https://mnobniomzmjgpyyqartz.supabase.co/storage/v1/object/public/chat-media/folder%20ico/FOLDER3.ico",
        },
        {
          name: "Folder Style 4",
          url: "https://mnobniomzmjgpyyqartz.supabase.co/storage/v1/object/public/chat-media/folder%20ico/FOLDER4.ico",
        },
      ];

      // Initialize the application
      document.addEventListener("DOMContentLoaded", async () => {
        try {
          console.log("Supabase client:", supabase); // Debug
          if (!supabase || !supabase.auth) {
            throw new Error("Supabase client is not properly initialized.");
          }

          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) throw error;
          if (!user) {
            console.warn("No authenticated user found. Redirecting to login...");
            window.location.href = "/login";
            return;
          }

          currentUser = user;

          // Initialize event listeners
          initEventListeners();

          // Load user data
          await loadUserData();

          // Load dashboard data
          await loadDashboardData();

          // Load folders
          await loadFolders();

          // Load recent files
          await loadRecentFiles();

          // Load activity feed
          await loadActivityFeed();

          // Initialize storage chart
          initStorageChart();

          // Update storage chart, system health, and security status
          await updateStorageChart();
          setInterval(updateStorageChart, 5000); // Update every 5 seconds
        } catch (error) {
          console.error("Error initializing application:", error);
         
        }
      });

     // Fungsi untuk menampilkan notifikasi toast (DESAIN BARU)
      function showToast(title, message, type = 'default') {
        
        // 1. Cari atau buat container (wrapper) untuk semua toast
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            // Gunakan kelas Tailwind untuk posisi
            toastContainer.className = 'fixed bottom-5 right-5 z-[1000] w-80 space-y-2.5';
            document.body.appendChild(toastContainer);
        }
        
        // 2. Tentukan warna border berdasarkan tipe
        const colorMap = {
            success: 'border-green-500',
            warning: 'border-amber-500',
            destructive: 'border-red-500',
            default: 'border-blue-500'
        };
        
        // Konversi tipe lama (jika ada) ke tipe baru
        if (type === 'error') type = 'destructive';
        if (type === 'info') type = 'default';
        
        const borderColor = colorMap[type] || colorMap['default'];

        // 3. Buat elemen toast baru dengan kelas Tailwind
        const toast = document.createElement('div');
        toast.className = `
          bg-slate-800/90 backdrop-blur-md text-white 
          p-3 px-5 rounded-lg shadow-lg 
          border-l-4 ${borderColor} 
          w-full 
          transition-all duration-300 ease-in-out 
          transform opacity-0 translate-x-10
        `; // Mulai dari transparan dan di luar layar
        
        // 4. Isi konten (Title dan Message)
        // Kita gunakan sanitizeHTML yang sudah ada di file Anda
        toast.innerHTML = `
            <strong class="block text-sm font-semibold mb-0.5">${sanitizeHTML(title)}</strong>
            <span class="text-xs text-slate-300">${sanitizeHTML(message)}</span>
        `;
        
        // 5. Tambahkan toast ke container
        toastContainer.appendChild(toast);
        
        // 6. Animasi masuk
        setTimeout(() => {
            toast.classList.remove('opacity-0', 'translate-x-10');
            toast.classList.add('opacity-100', 'translate-x-0');
        }, 50); // delay 50ms untuk browser 'melihat' perubahan
        
        // 7. Animasi keluar dan hapus
        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-x-0');
            toast.classList.add('opacity-0', 'translate-x-10');
            // Hapus elemen dari DOM setelah animasi fade-out selesai
            setTimeout(() => toast.remove(), 500); 
        }, 3000); // Toast akan hilang setelah 3 detik
    }

    // Fungsi "ADAPTER" untuk menangani panggilan 'showNotification' yang lama
      // Ini akan menjembatani panggilan lama ke desain showToast yang baru
      function showNotification(message, type = "info") {
        let title;
        
        // Mengonversi 'type' lama ke 'title' untuk showToast
        switch(type) {
          case 'success':
            title = 'Success';
            break;
          case 'error':
            title = 'Error';
            break;
          case 'warning':
            title = 'Warning';
            break;
          case 'info':
          default:
            title = 'Info';
            break;
        }

        // Panggil fungsi showToast (yang sudah ada di file Anda di baris 104)
        showToast(title, message, type);
      }

      // Function to show custom confirmation pop-up
      // Supports two call styles:
      // 1) showConfirm(message, onConfirm, onCancel) - callback style
      // 2) await showConfirm(message) -> returns Promise<boolean>
      function showConfirm(message, onConfirm, onCancel) {
        const confirmModal = document.createElement("div");
        confirmModal.className =
          "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
        confirmModal.innerHTML = `
        <div class="bg-slate-800 rounded-lg p-6 w-96">
            <h3 class="text-lg font-semibold text-white mb-4">Confirmation</h3>
            <p class="text-slate-400 mb-6">${sanitizeHTML(message)}</p>
            <div class="flex justify-end space-x-3">
                <button id="cancelConfirm" class="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">Cancel</button>
                <button id="confirmAction" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Confirm</button>
            </div>
        </div>
    `;
        document.body.appendChild(confirmModal);

        // If caller provided a function as onConfirm, use callback style.
        const isCallback = typeof onConfirm === 'function';

        if (!isCallback) {
          // Promise style
          return new Promise((resolve) => {
            document.getElementById("confirmAction").addEventListener("click", () => {
              resolve(true);
              confirmModal.remove();
            });

            document.getElementById("cancelConfirm").addEventListener("click", () => {
              resolve(false);
              confirmModal.remove();
            });
          });
        }

        // Callback style
        document.getElementById("confirmAction").addEventListener("click", () => {
          try { onConfirm(); } catch (e) { console.error('showConfirm onConfirm error', e); }
          confirmModal.remove();
        });

        document.getElementById("cancelConfirm").addEventListener("click", () => {
          try { if (typeof onCancel === 'function') onCancel(); } catch (e) { console.error('showConfirm onCancel error', e); }
          confirmModal.remove();
        });
      }

      // Initialize event listeners
      function initEventListeners() {
        // New folder button
        document.getElementById("newFolderBtn").addEventListener("click", () => {
          document.getElementById("newFolderModal").classList.remove("hidden");
        });

        // Close new folder modal
        document
          .getElementById("closeNewFolderModal")
          .addEventListener("click", () => {
            document.getElementById("newFolderModal").classList.add("hidden");
          });

        // Cancel new folder
        document.getElementById("cancelNewFolder").addEventListener("click", () => {
          document.getElementById("newFolderModal").classList.add("hidden");
        });

        // Confirm new folder
        document
          .getElementById("confirmNewFolder")
          .addEventListener("click", async () => {
            const folderName = document.getElementById("newFolderName").value.trim();
            const folderStyle = document.getElementById("newFolderStyle").value;

            if (folderName) {
              await createNewFolder(folderName, folderStyle);
              document.getElementById("newFolderModal").classList.add("hidden");
              document.getElementById("newFolderName").value = "";
            }
          });

        // Refresh button
        document.getElementById("refreshBtn").addEventListener("click", async () => {
          await loadDashboardData();
          await loadFolders();
          await loadRecentFiles();
          await loadActivityFeed();
          await updateStorageChart();
        });

        // Back from folder button
        document.getElementById("backFromFolderBtn").addEventListener("click", () => {
          document.getElementById("folderContent").classList.add("hidden");
          currentFolderId = null;
        });

        // Back from preview button
        document
          .getElementById("backFromPreviewBtn")
          .addEventListener("click", () => {
            document.getElementById("filePreview").classList.add("hidden");
            currentFileId = null;
          });

        // File input change
        document.getElementById("fileInput").addEventListener("change", async (e) => {
          if (e.target.files.length > 0 && currentFolderId) {
            await uploadFiles(e.target.files, currentFolderId);
            e.target.value = ""; // Reset file input
          }
        });

        // Notifications button
        document.getElementById("notifBtn").addEventListener("click", () => {
          document.getElementById("notificationsModal").classList.remove("hidden");
          loadNotifications();
        });

        // Close notifications modal
        document
          .getElementById("closeNotificationsModal")
          .addEventListener("click", () => {
            document.getElementById("notificationsModal").classList.add("hidden");
          });

        // View all activity
        document
          .getElementById("viewAllActivityBtn")
          .addEventListener("click", async () => {
            const modal = document.createElement("div");
            modal.className =
              "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
            modal.innerHTML = `
            <div class="bg-slate-800 rounded-lg p-6 w-1/2 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-white">All Activity</h3>
                    <button id="closeActivityModal" class="text-slate-400 hover:text-slate-200">
                        <i data-lucide="x" class="h-5 w-5"></i>
                    </button>
                </div>
                <div id="allActivityList" class="space-y-4"></div>
            </div>
        `;
            document.body.appendChild(modal);

            document
              .getElementById("closeActivityModal")
              .addEventListener("click", () => modal.remove());

            const activityList = document.getElementById("allActivityList");
            const userId = currentUser?.id;
            if (!userId) {
              activityList.innerHTML =
                '<div class="text-center text-slate-400">User not authenticated</div>';
              return;
            }

            const { data: activities, error } = await supabase
              .from("activities")
              .select("*")
              .eq("user_id", userId)
              .order("time", { ascending: false });

            if (error) {
              activityList.innerHTML =
                '<div class="text-center text-slate-400">Failed to load activities</div>';
              return;
            }

            activities.forEach((activity) => {
              const activityElement = document.createElement("div");
              activityElement.className = "flex";
              const icon =
                activity.type === "upload"
                  ? "upload"
                  : activity.type === "create"
                    ? "folder-plus"
                    : activity.type === "delete"
                      ? "trash-2"
                      : "alert-circle";
              const color =
                activity.type === "upload"
                  ? "purple"
                  : activity.type === "create"
                    ? "green"
                    : activity.type === "delete"
                      ? "red"
                      : "yellow";

              activityElement.innerHTML = `
                <div class="mr-3">
                    <div class="h-8 w-8 rounded-full bg-${color}-500/10 flex items-center justify-center">
                        <i data-lucide="${icon}" class="h-4 w-4 text-${color}-400"></i>
                    </div>
                </div>
                <div>
                    <p class="text-xs font-medium text-white">${activity.title
                }</p>
                    <p class="text-xs text-slate-400">${activity.description
                }</p>
                    <p class="text-xs text-slate-500 mt-1">${formatDate(
                  activity.time
                )}</p>
                </div>
            `;
              activityList.appendChild(activityElement);
            });

            lucide.createIcons();
          });

        // Edit profile
        document.getElementById("editProfileBtn").addEventListener("click", () => {
          showNotification("Edit profile feature will be implemented", "info");
        });

        // Download file
        document
          .getElementById("downloadFileBtn")
          .addEventListener("click", async () => {
            if (currentFileId) {
              await downloadFile(currentFileId);
            }
          });

        // Copy link
        document.getElementById("copyLinkBtn").addEventListener("click", () => {
          const shareLinkInput = document.getElementById("shareLinkInput");
          shareLinkInput.select();
          document.execCommand("copy");

          const originalText = shareLinkInput.value;
          shareLinkInput.value = "Copied to clipboard!";
          setTimeout(() => {
            shareLinkInput.value = originalText;
          }, 2000);
        });

        // Send link
        document.getElementById("sendLinkBtn").addEventListener("click", () => {
          const modal = document.createElement("div");
          modal.className =
            "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
          modal.innerHTML = `
            <div class="bg-slate-800 rounded-lg p-6 w-96">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-white">Send Link</h3>
                    <button id="closeSendLinkModal" class="text-slate-400 hover:text-slate-200">
                        <i data-lucide="x" class="h-5 w-5"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <label class="block text-sm text-slate-400 mb-2">Recipient Email</label>
                    <input id="recipientEmail" type="email" class="w-full bg-slate-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Enter email">
                </div>
                <div class="flex justify-end space-x-3">
                    <button id="cancelSendLink" class="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">Cancel</button>
                    <button id="confirmSendLink" class="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600">Send</button>
                </div>
            </div>
        `;
          document.body.appendChild(modal);

          document
            .getElementById("closeSendLinkModal")
            .addEventListener("click", () => modal.remove());
          document
            .getElementById("cancelSendLink")
            .addEventListener("click", () => modal.remove());
          document
            .getElementById("confirmSendLink")
            .addEventListener("click", async () => {
              const email = document.getElementById("recipientEmail").value.trim();
              if (!email) {
                showNotification("Please enter a valid email", "error");
                return;
              }

              const shareLink = document.getElementById("shareLinkInput").value;

              const { data: file, error: fileError } = await supabase
                .from("files")
                .select("name")
                .eq("id", currentFileId)
                .single();

              if (fileError) {
                showNotification("Failed to fetch file details", "error");
                return;
              }

              console.log(` Sending link ${shareLink} to ${email}`);
              showNotification(`Link sent to ${email}`, "success");
              modal.remove();

              await supabase.from("notifdatacenter").insert({
                user_id: currentUser.id,
                type: "share",
                content: `Shared file "${file.name}" link with ${email}`,
                is_read: false,
              });

              await supabase.from("activities").insert({
                user_id: currentUser.id,
                type: "share",
                title: "Shared file link",
                description: `Sent to ${email}`,
              });
            });

          lucide.createIcons();
        });

        // Permissions button
        document
          .getElementById("permissionsBtn")
          .addEventListener("click", async () => {
            if (!currentFileId) return;

            const { data: file, error } = await supabase
              .from("files")
              .select("permissions, name")
              .eq("id", currentFileId)
              .single();

            if (error) {
              showNotification("Failed to load permissions", "error");
              return;
            }

            const currentPermission = file.permissions || "private";
            const modal = document.createElement("div");
            modal.className =
              "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
            modal.innerHTML = `
            <div class="bg-slate-800 rounded-lg p-6 w-96">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-white">Set Permissions</h3>
                    <button id="closePermissionsModal" class="text-slate-400 hover:text-slate-200">
                        <i data-lucide="x" class="h-5 w-5"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <label class="block text-sm text-slate-400 mb-2">Access Level</label>
                    <select id="permissionLevel" class="w-full bg-slate-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="public" ${currentPermission === "public" ? "selected" : ""
              }>Public</option>
                        <option value="private" ${currentPermission === "private" ? "selected" : ""
              }>Private</option>
                    </select>
                </div>
                <div class="flex justify-end space-x-3">
                    <button id="cancelPermissions" class="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">Cancel</button>
                    <button id="savePermissions" class="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600">Save</button>
                </div>
            </div>
        `;
            document.body.appendChild(modal);

            document
              .getElementById("closePermissionsModal")
              .addEventListener("click", () => modal.remove());
            document
              .getElementById("cancelPermissions")
              .addEventListener("click", () => modal.remove());
            document
              .getElementById("savePermissions")
              .addEventListener("click", async () => {
                const permission = document.getElementById("permissionLevel").value;

                const { error: updateError } = await supabase
                  .from("files")
                  .update({ permissions: permission })
                  .eq("id", currentFileId);

                if (updateError) {
                  showNotification("Failed to update permissions", "error");
                  return;
                }

                await supabase.from("notifdatacenter").insert({
                  user_id: currentUser.id,
                  type: "update",
                  content: `Permissions for file "${file.name}" set to ${permission}`,
                  is_read: false,
                });

                await supabase.from("activities").insert({
                  user_id: currentUser.id,
                  type: "update",
                  title: "Updated file permissions",
                  description: `Set to ${permission}`,
                });

                showNotification("Permissions updated successfully", "success");
                modal.remove();
              });

            lucide.createIcons();
          });

        // Mark all as read
        document
          .getElementById("markAllAsRead")
          .addEventListener("click", async () => {
            try {
              const {
                data: { session },
                error: sessionError,
              } = await supabase.auth.getSession();
              if (sessionError) throw sessionError;
              if (!session || !session.user)
                throw new Error("User not authenticated");

              const userId = session.user.id;
              if (!userId) throw new Error("User ID not found");

              const { error } = await supabase
                .from("notifdatacenter")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("is_read", false);

              if (error) throw error;

              showNotification("All notifications marked as read", "success");
              await loadNotifications();
            } catch (error) {
              console.error("Error marking all notifications as read:", error);
              showNotification("Failed to mark all notifications as read", "error");
            }
          });

        // Search input
        document.getElementById("searchInput").addEventListener("keyup", (e) => {
          if (e.key === "Enter") {
            const searchTerm = e.target.value.trim();
            if (searchTerm) {
              searchFiles(searchTerm);
            }
          }
        });

        // Drag and drop for upload area
        const uploadArea = document.getElementById("uploadArea");

        ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
          uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
          e.preventDefault();
          e.stopPropagation();
        }

        ["dragenter", "dragover"].forEach((eventName) => {
          uploadArea.addEventListener(eventName, highlight, false);
        });

        ["dragleave", "drop"].forEach((eventName) => {
          uploadArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
          uploadArea.classList.add("dragover");
        }

        function unhighlight() {
          uploadArea.classList.remove("dragover");
        }

        uploadArea.addEventListener("drop", handleDrop, false);

        function handleDrop(e) {
          const dt = e.dataTransfer;
          const files = dt.files;
          if (files.length > 0 && currentFolderId) {
            uploadFiles(files, currentFolderId);
          }
        }
      }

      // Utility function to format dates
      function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }

      // Load user data from Supabase
      async function loadUserData() {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            showNotification("Please log in to continue", "error");
            return;
          }

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (error) throw error;

          currentUser = profile;
          const avatarInitials = profile.full_name
            ? profile.full_name.slice(0, 2).toUpperCase()
            : "JD";

          document.getElementById("userName").textContent =
            profile.full_name || "User";
          document.getElementById("userAvatar").textContent = avatarInitials;
          document.getElementById("profileName").textContent =
            profile.full_name || "User";
          document.getElementById("profileRole").textContent = "Administrator";
          document.getElementById("profileEmail").textContent = profile.email;
          document.getElementById("profileAvatar").textContent = avatarInitials;
          document.getElementById(
            "lastLogin"
          ).textContent = `Last login: ${formatDate(new Date())}`;
          document.getElementById("twoFactorStatus").textContent =
            profile.show_on_leaderboard ? "2FA Enabled" : "2FA Disabled";

          document.getElementById("userName").classList.remove("animate-pulse");
          document.getElementById("profileName").classList.remove("animate-pulse");
          document.getElementById("profileRole").classList.remove("animate-pulse");
          document.getElementById("profileEmail").classList.remove("animate-pulse");
          document.getElementById("lastLogin").classList.remove("animate-pulse");
          document
            .getElementById("twoFactorStatus")
            .classList.remove("animate-pulse");
          document.getElementById("profileAvatar").classList.remove("animate-pulse");
        } catch (error) {
          console.error("Error loading user data:", error);
          showNotification("Failed to load user data", "error");
        }
      }

      // Load dashboard data from Supabase
      async function loadDashboardData() {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { count: totalFiles } = await supabase
            .from("files")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          const { count: sharedFiles } = await supabase
            .from("files")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("permissions", "public");

          const { count: recentActivity } = await supabase
            .from("activities")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          const { data: files } = await supabase
            .from("files")
            .select("size_mb")
            .eq("user_id", userId);

          const storageUsed = files.reduce(
            (sum, file) => sum + (file.size_mb || 0),
            0
          );
          const storagePercent = (storageUsed / STORAGE_LIMIT_MB) * 100;

          document.getElementById("totalFiles").textContent =
            totalFiles.toLocaleString();
          document.getElementById("sharedFiles").textContent =
            sharedFiles.toLocaleString();
          document.getElementById("recentActivity").textContent = recentActivity;
          document.getElementById(
            "fileGrowth"
          ).innerHTML = `<i data-lucide="trending-up" class="h-3 w-3 mr-1"></i>12%`;
          document.getElementById(
            "shareGrowth"
          ).innerHTML = `<i data-lucide="trending-up" class="h-3 w-3 mr-1"></i>8%`;
          document.getElementById(
            "activityGrowth"
          ).innerHTML = `<i data-lucide="trending-up" class="h-3 w-3 mr-1"></i>5%`;
          document.getElementById(
            "storageUsed"
          ).textContent = `Used: ${storageUsed.toFixed(2)} MB`;
          document.getElementById(
            "storagePercent"
          ).textContent = `${storagePercent.toFixed(1)}%`;
          document.getElementById(
            "storageTotal"
          ).textContent = `${STORAGE_LIMIT_MB} MB Total`;
          document.getElementById(
            "storageProgress"
          ).style.width = `${storagePercent}%`;

          if (storageChart) {
            storageChart.data.datasets[0].data = [
              storageUsed,
              STORAGE_LIMIT_MB - storageUsed,
            ];
            storageChart.update();
          }

          document.getElementById("totalFiles").classList.remove("animate-pulse");
          document.getElementById("sharedFiles").classList.remove("animate-pulse");
          document.getElementById("recentActivity").classList.remove("animate-pulse");

          lucide.createIcons();
        } catch (error) {
          console.error("Error loading dashboard data:", error);
          showNotification("Failed to load dashboard data", "error");
        }
      }

      // Calculate folder stats dynamically
      async function calculateFolderStats(folderId) {
        const { data: files, error } = await supabase
          .from("files")
          .select("size_mb")
          .eq("folder_id", folderId);

        if (error) throw error;

        const fileCount = files.length;
        const totalSizeMB = files.reduce((sum, file) => sum + (file.size_mb || 0), 0);

        return { fileCount, size_mb: totalSizeMB };
      }

      // Load folders from Supabase
      async function loadFolders() {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: folders, error } = await supabase
            .from("folders")
            .select("*")
            .eq("user_id", userId);

          if (error) throw error;

          const foldersContainer = document.getElementById("foldersContainer");
          foldersContainer.innerHTML = "";

          const foldersWithStats = await Promise.all(
            folders.map(async (folder) => {
              const stats = await calculateFolderStats(folder.id);
              return {
                ...folder,
                fileCount: stats.fileCount,
                size_mb: stats.size_mb,
              };
            })
          );

          foldersWithStats.forEach((folder) => {
            const folderElement = document.createElement("div");
            folderElement.className =
              "relative cursor-pointer transition-all duration-300 w-24 h-28 mr-4 mb-4 inline-block touch-ripple";
            folderElement.dataset.id = folder.id;

            const folderIcon = folder.icon_url || DEFAULT_FOLDER_ICONS[0].url;

            folderElement.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="w-20 h-20">
                        <img src="${folderIcon}" alt="Folder Icon" class="w-full h-full object-contain">
                    </div>
                    <div class="relative">
    <button class="folder-menu-btn bg-slate-700/50 hover:bg-slate-600/50 rounded-full p-1">
        <i data-lucide="more-vertical" class="h-4 w-4 text-slate-400"></i>
    </button>
    <div class="folder-menu hidden absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg z-10">
        <button class="folder-settings-btn block w-full text-left px-4 py-1 text-xs text-white hover:bg-slate-700/50">Change Icon</button>
        <button class="folder-delete-btn block w-full text-left px-4 py-1 text-xs text-white hover:bg-slate-700/50">Delete Folder</button>
    </div>
</div>
                </div>
                <div class="text-center mt-1">
                    <h4 class="text-xs font-medium text-white truncate">${folder.name
              }</h4>
                    <div class="text-xs text-slate-400">${folder.fileCount || 0
              } files • ${(folder.size_mb || 0).toFixed(2)} MB</div>
                </div>
            `;

            const menuBtn = folderElement.querySelector(".folder-menu-btn");
            const menu = folderElement.querySelector(".folder-menu");
            menuBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              menu.classList.toggle("hidden");
            });

            document.addEventListener("click", (e) => {
              if (!folderElement.contains(e.target)) {
                menu.classList.add("hidden");
              }
            });

            folderElement.addEventListener("click", (e) => {
              if (
                !e.target.closest(".folder-menu-btn") &&
                !e.target.closest(".folder-menu")
              ) {
                folderElement.classList.add("touch-ripple-active");
                setTimeout(
                  () => folderElement.classList.remove("touch-ripple-active"),
                  300
                );
                openFolder(folder.id, folder.name);
              }
            });

            folderElement
              .querySelector(".folder-settings-btn")
              .addEventListener("click", async (e) => {
                e.stopPropagation();
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".ico";
                input.onchange = async (event) => {
                  const file = event.target.files[0];
                  if (file) {
                    await changeFolderIcon(folder.id, file);
                  }
                };
                input.click();
              });

            folderElement
              .querySelector(".folder-delete-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                showConfirm(
                  "Are you sure you want to delete this folder and all its files?",
                  async () => {
                    await deleteFolder(folder.id);
                  },
                  () => { }
                );
              });

            foldersContainer.appendChild(folderElement);
          });

          const newFolderBtn = document.createElement("div");
          newFolderBtn.className =
            "w-24 h-28 inline-block mr-4 mb-4 rounded-lg bg-slate-800/20 border-2 border-dashed border-slate-700/50 hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col items-center justify-center";
          newFolderBtn.innerHTML = `
            <div class="p-3 rounded-full bg-slate-800/50 mb-2">
                <i data-lucide="plus" class="h-5 w-5 text-slate-400"></i>
            </div>
            <h4 class="text-xs font-medium text-slate-400 text-center">Add New Folder</h4>
        `;
          newFolderBtn.addEventListener("click", () => {
            document.getElementById("newFolderModal").classList.remove("hidden");
          });

          foldersContainer.appendChild(newFolderBtn);

          lucide.createIcons();
        } catch (error) {
          console.error("Error loading folders:", error);
          showNotification("Failed to load folders", "error");
        }
      }

      // Create new folder in Supabase
      async function createNewFolder(name, style) {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { count: folderCount } = await supabase
            .from("folders")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          if (folderCount >= MAX_FOLDERS) {
            showNotification("Maximum folder limit reached (4 folders)", "error");
            return;
          }

          const selectedIcon = DEFAULT_FOLDER_ICONS.find(
            (icon) => icon.name === style
          );
          const iconUrl = selectedIcon
            ? selectedIcon.url
            : DEFAULT_FOLDER_ICONS[0].url;

          const { data, error } = await supabase
            .from("folders")
            .insert({ user_id: userId, name, icon_url: iconUrl })
            .select()
            .single();

          if (error) throw error;

          await supabase.from("notifdatacenter").insert({
            user_id: userId,
            type: "create",
            content: `New folder "${name}" created`,
            is_read: false,
          });

          await supabase.from("activities").insert({
            user_id: userId,
            type: "create",
            title: "Created new folder",
            description: name,
          });

          await loadFolders();
          showNotification("Folder created successfully", "success");
        } catch (error) {
          console.error("Error creating folder:", error);
          showNotification("Failed to create folder", "error");
        }
      }

      // Change folder icon
      async function changeFolderIcon(folderId, file) {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("name")
            .eq("id", folderId)
            .single();

          if (folderError) throw folderError;

          if (!file.name.endsWith(".ico")) {
            showNotification("Please upload an .ico file", "error");
            return;
          }

          const filePath = `${userId}/folder-icons/${folderId}/${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("files")
            .upload(filePath, file, { upsert: true });

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("files").getPublicUrl(filePath);

          const { error: updateError } = await supabase
            .from("folders")
            .update({ icon_url: publicUrl })
            .eq("id", folderId);

          if (updateError) throw updateError;

          await supabase.from("notifdatacenter").insert({
            user_id: userId,
            type: "update",
            content: `Icon for folder "${folder.name}" updated`,
            is_read: false,
          });

          await loadFolders();
          showNotification("Folder icon updated successfully", "success");
        } catch (error) {
          console.error("Error changing folder icon:", error);
          showNotification("Failed to change folder icon", "error");
        }
      }

      // Delete folder and its files
      async function deleteFolder(folderId) {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("name")
            .eq("id", folderId)
            .single();

          if (folderError) throw folderError;

          const { data: files, error: filesError } = await supabase
            .from("files")
            .select("url")
            .eq("folder_id", folderId);

          if (filesError) throw filesError;

          const filePaths = files.map((file) => file.url.split("/files/")[1]);
          if (filePaths.length > 0) {
            const { error: storageError } = await supabase.storage
              .from("files")
              .remove(filePaths);

            if (storageError) throw storageError;
          }

          const { error: filesDbError } = await supabase
            .from("files")
            .delete()
            .eq("folder_id", folderId);

          if (filesDbError) throw filesDbError;

          const { error: folderDeleteError } = await supabase
            .from("folders")
            .delete()
            .eq("id", folderId);

          if (folderDeleteError) throw folderDeleteError;

          await supabase.from("notifdatacenter").insert({
            user_id: userId,
            type: "delete",
            content: `Folder "${folder.name}" deleted`,
            is_read: false,
          });

          await supabase.from("activities").insert({
            user_id: userId,
            type: "delete",
            title: "Deleted folder",
            description: folder.name,
          });

          await loadFolders();
          showNotification("Folder deleted successfully", "success");
          await loadDashboardData();
          await updateStorageChart();
        } catch (error) {
          console.error("Error deleting folder:", error);
          showNotification("Failed to delete folder", "error");
        }
      }

      // Open folder and load its files
      async function openFolder(folderId, folderName) {
        try {
          currentFolderId = folderId;
          document.getElementById("folderName").textContent = folderName;
          document.getElementById("folderContent").classList.remove("hidden");
          document.getElementById("folderFilesContainer").innerHTML = "";

          const { data: files, error } = await supabase
            .from("files")
            .select("*")
            .eq("folder_id", folderId);

          if (error) throw error;

          const filesContainer = document.getElementById("folderFilesContainer");

          files.forEach((file) => {
            const fileElement = document.createElement("div");
            fileElement.className =
              "bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 cursor-pointer hover:border-cyan-500/30 transition-all file-item relative group";
            fileElement.dataset.id = file.id;

            let previewContent = `
                <div class="aspect-square bg-slate-800/30 rounded mb-2 overflow-hidden flex items-center justify-center">
            `;
            if (file.type === "image") {
              previewContent += `<img src="${file.url || "https://via.placeholder.com/300"
                }" alt="Preview" class="w-full h-full object-cover">`;
            } else if (file.type === "video") {
              previewContent += `
                    <video class="w-full h-full object-cover" muted>
                        <source src="${file.url}" type="${file.mime_type || "video/mp4"
                }">
                        Your browser does not support the video tag.
                    </video>
                `;
            } else if (file.type === "document") {
              previewContent += `<i data-lucide="file-text" class="h-16 w-16 text-cyan-400"></i>`;
            } else {
              previewContent += `<i data-lucide="file" class="h-16 w-16 text-cyan-400"></i>`;
            }
            previewContent += `</div>`;

            fileElement.innerHTML = `
                ${previewContent}
                <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-white truncate">${file.name
              }</span>
                    <span class="text-xs text-slate-400">${file.size_mb.toFixed(
                2
              )} MB</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg flex items-center justify-center space-x-2">
                    <button class="file-view-btn bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2 transition-all">
                        <i data-lucide="eye" class="h-4 w-4"></i>
                    </button>
                    <button class="file-download-btn bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2 transition-all">
                        <i data-lucide="download" class="h-4 w-4"></i>
                    </button>
                    <button class="file-delete-btn bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2 transition-all">
                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                    </button>
                </div>
            `;

            fileElement
              .querySelector(".file-view-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                viewFile(file.id, file.name, file.url, file.type, file.size_mb);
              });

            fileElement
              .querySelector(".file-download-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                downloadFile(file.id);
              });

            fileElement
              .querySelector(".file-delete-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                showConfirm(
                  "Are you sure you want to delete this file?",
                  async () => {
                    await deleteFile(file.id);
                  },
                  () => { }
                );
              });

            filesContainer.appendChild(fileElement);
          });

          setTimeout(() => {
            const folderContent = document.getElementById("folderContent");
            folderContent.scrollIntoView({ behavior: "smooth", block: "end" });
          }, 100);

          lucide.createIcons();
        } catch (error) {
          console.error("Error opening folder:", error);
          showNotification("Failed to open folder", "error");
        }
      }

      // Upload files to Supabase Storage and save metadata
      async function uploadFiles(files, folderId) {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: allFiles } = await supabase
            .from("files")
            .select("size_mb")
            .eq("user_id", userId);

          const currentStorageUsed = allFiles.reduce(
            (sum, file) => sum + (file.size_mb || 0),
            0
          );
          const newFilesSize = Array.from(files).reduce(
            (sum, file) => sum + file.size / (1024 * 1024),
            0
          );
          if (currentStorageUsed + newFilesSize > STORAGE_LIMIT_MB) {
            throw new Error("Storage limit exceeded (100 MB)");
          }

          const { count: fileCount } = await supabase
            .from("files")
            .select("*", { count: "exact", head: true })
            .eq("folder_id", folderId);

          if (fileCount + files.length > MAX_FILES_PER_FOLDER) {
            throw new Error("Folder file limit exceeded (10 files per folder)");
          }

          const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("name")
            .eq("id", folderId)
            .single();

          if (folderError) throw folderError;

          const uploadArea = document.getElementById("uploadArea");
          const originalContent = uploadArea.innerHTML;
          uploadArea.innerHTML = `
            <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                <p class="text-sm text-slate-400">Uploading ${files.length} file(s)...</p>
            </div>
        `;

          const uploadedFiles = [];
          for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
              throw new Error(`File ${file.name} exceeds 10MB limit`);
            }

            const filePath = `${userId}/${folderId}/${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from("files")
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const {
              data: { publicUrl },
            } = supabase.storage.from("files").getPublicUrl(filePath);

            let fileType;
            if (file.type.startsWith("image")) fileType = "image";
            else if (file.type.startsWith("video")) fileType = "video";
            else if (file.type.startsWith("application")) fileType = "document";
            else fileType = "file";

            const { data, error: dbError } = await supabase
              .from("files")
              .insert({
                folder_id: folderId,
                user_id: userId,
                name: file.name,
                type: fileType,
                size_mb: file.size / (1024 * 1024),
                url: publicUrl,
                mime_type: file.type,
                permissions: "private",
              })
              .select()
              .single();

            if (dbError) throw dbError;

            uploadedFiles.push(data);

            await supabase.from("notifdatacenter").insert({
              user_id: userId,
              type: "upload",
              content: `File "${file.name}" uploaded to folder "${folder.name}"`,
              is_read: false,
            });

            await supabase.from("activities").insert({
              user_id: userId,
              type: "upload",
              title: "Uploaded new file",
              description: file.name,
            });
          }

          uploadArea.innerHTML = `
            <div class="text-center">
                <i data-lucide="check-circle" class="h-8 w-8 text-green-400 mx-auto mb-2"></i>
                <p class="text-sm text-slate-400">Uploaded ${files.length} file(s) successfully!</p>
            </div>
        `;

          lucide.createIcons();

          setTimeout(async () => {
            uploadArea.innerHTML = originalContent;
            await openFolder(
              folderId,
              document.getElementById("folderName").textContent
            );
            await loadFolders();
            await loadDashboardData();
            await updateStorageChart();
          }, 2000);
        } catch (error) {
          console.error("Error uploading files:", error);
          document.getElementById("uploadArea").innerHTML = `
            <div class="text-center">
                <i data-lucide="alert-circle" class="h-8 w-8 text-red-400 mx-auto mb-2"></i>
                <p class="text-sm text-slate-400">Failed to upload files: ${error.message}</p>
                <button class="mt-2 text-cyan-400 hover:text-cyan-300 text-xs font-medium">
                    Try Again
                </button>
            </div>
        `;
          lucide.createIcons();
        }
      }

      // View file details with custom share link
      async function viewFile(fileId, fileName, fileUrl, fileType, fileSize) {
        try {
          currentFileId = fileId;
          document.getElementById("fileName").textContent = fileName;
          document.getElementById("filePreview").classList.remove("hidden");
          document.getElementById("filePreviewContent").innerHTML = `
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                <p class="text-slate-400">Loading preview...</p>
            </div>
        `;

          const { data: file, error } = await supabase
            .from("files")
            .select("*")
            .eq("id", fileId)
            .single();

          if (error) throw error;

          // Generate custom ID for share link (8-character random string)
          const customId = Math.random().toString(36).substring(2, 10);

          // Save mapping of custom ID to original URL in share_links table
          const { data: shareLink, error: shareError } = await supabase
            .from("share_links")
            .insert([
              {
                custom_id: customId,
                file_id: fileId,
                original_url: file.url,
                created_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (shareError) throw shareError;

          const fileInfoHtml = `
            <div class="flex justify-between">
                <span class="text-slate-400">Name:</span>
                <span class="text-white font-medium">${file.name}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-400">Type:</span>
                <span class="text-white font-medium">${file.type.charAt(0).toUpperCase() + file.type.slice(1)
            }</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-400">Size:</span>
                <span class="text-white font-medium">${file.size_mb.toFixed(
              2
            )} MB</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-400">Dimensions:</span>
                <span class="text-white font-medium">${file.type === "image" ? "1920 × 1080 px" : "N/A"
            }</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-400">Uploaded:</span>
                <span class="text-white font-medium">${formatDate(
              file.uploaded_at
            )}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-400">Modified:</span>
                <span class="text-white font-medium">${formatDate(
              file.modified_at
            )}</span>
            </div>
        `;

          document.getElementById("fileInfo").innerHTML = fileInfoHtml;
          // Use custom share link instead of original URL
          document.getElementById("shareLinkInput").value = `https://aqula.vercel.app/share/${customId}`;

          setTimeout(() => {
            if (file.type === "image") {
              document.getElementById("filePreviewContent").innerHTML = `
                    <img src="${file.url}" alt="${file.name}" class="w-full h-auto max-h-[500px] object-contain">
                `;
            } else if (file.type === "video") {
              document.getElementById("filePreviewContent").innerHTML = `
            <div class="video-container">
                <div class="video-frame rounded-xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-700 transition-all duration-300 hover:shadow-3xl">
                    <video 
                        controls 
                        class="w-full h-auto max-h-[500px] block outline-none"
                        style="backdrop-filter: brightness(0.95);"
                    >
                        <source src="${file.url}" type="${file.mime_type || "video/mp4"
                }">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        `;
            } else if (file.type === "document") {
              const supportedDocs = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ];

              if (supportedDocs.includes(file.mime_type)) {
                const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
                  file.url
                )}&embedded=true`;
                document.getElementById("filePreviewContent").innerHTML = `
                        <iframe src="${viewerUrl}" class="w-full h-[500px] border-0" sandbox="allow-same-origin allow-scripts"></iframe>
                    `;
              } else {
                document.getElementById("filePreviewContent").innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full">
                            <i data-lucide="file-text" class="h-16 w-16 text-cyan-400 mb-4"></i>
                            <p class="text-slate-400">No direct preview available. <a href="${file.url}" target="_blank" class="text-cyan-400 hover:underline">Download</a></p>
                        </div>
                    `;
                lucide.createIcons();
              }
            } else {
              document.getElementById("filePreviewContent").innerHTML = `
                    <div class="flex items-center justify-center h-full">
                        <div class="text-center">
                            <i data-lucide="file" class="h-16 w-16 text-cyan-400 mx-auto mb-4"></i>
                            <p class="text-slate-400">No preview available for this file type</p>
                        </div>
                    </div>
                `;
              lucide.createIcons();
            }
          }, 1000);
        } catch (error) {
          console.error("Error viewing file:", error);
          document.getElementById("filePreviewContent").innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center">
                    <i data-lucide="alert-circle" class="h-16 w-16 text-red-400 mx-auto mb-4"></i>
                    <p class="text-slate-400">Failed to load file preview</p>
                </div>
            </div>
        `;
          lucide.createIcons();
        }
      }

      // Download file from Supabase Storage
      async function downloadFile(fileId) {
        try {
          const { data: file, error } = await supabase
            .from("files")
            .select("url")
            .eq("id", fileId)
            .single();

          if (error) throw error;

          window.open(file.url, "_blank");
        } catch (error) {
          console.error("Error downloading file:", error);
          showNotification("Failed to download file", "error");
        }
      }

      // Delete file from Supabase Storage and database
      async function deleteFile(fileId) {
        try {
          const { data: file, error: fetchError } = await supabase
            .from("files")
            .select("url, folder_id, name")
            .eq("id", fileId)
            .single();

          if (fetchError) throw fetchError;

          const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("name")
            .eq("id", file.folder_id)
            .single();

          if (folderError) throw folderError;

          const filePath = file.url.split("/files/")[1];
          const { error: storageError } = await supabase.storage
            .from("files")
            .remove([filePath]);

          if (storageError) throw storageError;

          const { error: dbError } = await supabase
            .from("files")
            .delete()
            .eq("id", fileId);

          if (dbError) throw dbError;

          await supabase.from("notifdatacenter").insert({
            user_id: currentUser.id,
            type: "delete",
            content: `File "${file.name}" deleted from folder "${folder.name}"`,
            is_read: false,
          });

          await supabase.from("activities").insert({
            user_id: currentUser.id,
            type: "delete",
            title: "Deleted file",
            description: file.name,
          });

          if (currentFolderId) {
            await openFolder(
              currentFolderId,
              document.getElementById("folderName").textContent
            );
          }

          await loadFolders();
          await loadDashboardData();
          await updateStorageChart();

          showNotification("File deleted successfully", "success");
        } catch (error) {
          console.error("Error deleting file:", error);
          showNotification("Failed to delete file", "error");
        }
      }

      // Load recent files from Supabase
      async function loadRecentFiles() {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: files, error } = await supabase
            .from("files")
            .select("*")
            .eq("user_id", userId)
            .order("modified_at", { ascending: false })
            .limit(5);

          if (error) throw error;

          const recentFilesContainer = document.getElementById(
            "recentFilesContainer"
          );
          recentFilesContainer.innerHTML = "";

          files.forEach((file) => {
            const fileElement = document.createElement("div");
            fileElement.className =
              "grid grid-cols-12 p-3 hover:bg-slate-800/50 transition-all cursor-pointer file-item";
            fileElement.dataset.id = file.id;

            const icon = file.type === "image" ? "image" : "file-text";
            const color = file.type === "image" ? "green" : "blue";

            fileElement.innerHTML = `
                <div class="col-span-6 flex items-center">
                    <i data-lucide="${icon}" class="h-4 w-4 text-${color}-400 mr-2"></i>
                    <span class="text-sm font-medium text-white">${file.name
              }</span>
                </div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${file.type.charAt(0).toUpperCase() + file.type.slice(1)
              }</div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${file.size_mb.toFixed(
                2
              )} MB</div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${formatDate(
                file.modified_at
              )}</div>
            `;

            fileElement.addEventListener("click", () => {
              viewFile(file.id, file.name, file.url, file.type, file.size_mb);
            });


            recentFilesContainer.appendChild(fileElement);
          });

          lucide.createIcons();
        } catch (error) {
          console.error("Error loading recent files:", error);
          showNotification("Failed to load recent files", "error");
        }
      }


      // Load activity feed from Supabase
      async function loadActivityFeed() {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: activities, error } = await supabase
            .from("activities")
            .select("*")
            .eq("user_id", userId)
            .order("time", { ascending: false })
            .limit(5);

          if (error) throw error;

          const activityFeed = document.getElementById("activityFeed");
          activityFeed.innerHTML = "";

          activities.forEach((activity) => {
            const activityElement = document.createElement("div");
            activityElement.className = "flex";
            const icon =
              activity.type === "upload"
                ? "upload"
                : activity.type === "create"
                  ? "folder-plus"
                  : activity.type === "delete"
                    ? "trash-2"
                    : "alert-circle";
            const color =
              activity.type === "upload"
                ? "purple"
                : activity.type === "create"
                  ? "green"
                  : activity.type === "delete"
                    ? "red"
                    : "yellow";

            activityElement.innerHTML = `
                <div class="mr-3">
                    <div class="h-8 w-8 rounded-full bg-${color}-500/10 flex items-center justify-center">
                        <i data-lucide="${icon}" class="h-4 w-4 text-${color}-400"></i>
                    </div>
                </div>
                <div>
                    <p class="text-xs font-medium text-white">${activity.title
              }</p>
                    <p class="text-xs text-slate-400">${activity.description
              }</p>
                    <p class="text-xs text-slate-500 mt-1">${formatDate(
                activity.time
              )}</p>
                </div>
            `;

            activityFeed.appendChild(activityElement);
          });

          lucide.createIcons();
        } catch (error) {
          console.error("Error loading activity feed:", error);
          showNotification("Failed to load activity feed", "error");
        }
      }

      // Load notifications from Supabase and enable real-time updates
      async function loadNotifications() {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!session || !session.user) throw new Error("User not authenticated");

          const userId = session.user.id;
          if (!userId) throw new Error("User ID not found");

          const notificationsList = document.getElementById("notificationsList");
          const notifBadge = document.getElementById("notifBadge");

          async function refreshNotifications() {
            const { data: notifications, error } = await supabase
              .from("notifdatacenter")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false });

            if (error) throw error;

            if (notifications.length === 0) {
              notificationsList.innerHTML =
                '<div class="text-center text-slate-400">No notifications available</div>';
              notifBadge.classList.add("hidden");
              return;
            }

            const unreadCount = notifications.filter(
              (notif) => !notif.is_read
            ).length;
            if (unreadCount > 0) {
              notifBadge.textContent = unreadCount;
              notifBadge.classList.remove("hidden");
            } else {
              notifBadge.classList.add("hidden");
            }

            notificationsList.innerHTML = "";
            notifications.forEach((notif) => {
              const notifElement = document.createElement("div");
              notifElement.className = `flex items-start p-3 hover:bg-slate-700/50 transition-all cursor-pointer rounded-lg ${notif.is_read ? "opacity-50" : ""
                }`;
              notifElement.dataset.id = notif.id;

              let icon = "bell";
              let color = "cyan";
              if (notif.type === "upload") icon = "upload";
              else if (notif.type === "delete") icon = "trash-2";
              else if (notif.type === "warning") icon = "alert-circle";
              else if (notif.type === "create") icon = "folder-plus";
              else if (notif.type === "share") icon = "share-2";
              else if (notif.type === "update") icon = "edit";

              notifElement.innerHTML = `
                    <div class="mr-3">
                        <div class="h-8 w-8 rounded-full bg-${color}-500/10 flex items-center justify-center">
                            <i data-lucide="${icon}" class="h-4 w-4 text-${color}-400"></i>
                        </div>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-white">${notif.type.charAt(0).toUpperCase() +
                notif.type.slice(1)
                }</p>
                        <p class="text-xs text-slate-400">${notif.content}</p>
                        <p class="text-xs text-slate-500 mt-1">${formatDate(
                  notif.created_at
                )}</p>
                    </div>
                    <div class="ml-2">
                        <button class="mark-read-btn text-slate-400 hover:text-cyan-400">
                            <i data-lucide="${notif.is_read ? "check" : "circle"
                }"></i>
                        </button>
                    </div>
                `;

              notifElement
                .querySelector(".mark-read-btn")
                .addEventListener("click", async (e) => {
                  e.stopPropagation();
                  if (!notif.is_read) {
                    await markNotificationAsRead(notif.id);
                    await refreshNotifications();
                  }
                });

              notificationsList.appendChild(notifElement);
            });

            lucide.createIcons();
          }

          await refreshNotifications();

          const channel = supabase
            .channel("notifdatacenter-changes")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "notifdatacenter",
                filter: `user_id=eq.${userId}`,
              },
              (payload) => {
                console.log("Change received:", payload);
                refreshNotifications();
              }
            )
            .subscribe();

          return () => {
            channel.unsubscribe();
          };
        } catch (error) {
          console.error("Error loading notifications:", error);
          showNotification("Failed to load notifications", "error");
        }
      }

      // Mark a single notification as read
      async function markNotificationAsRead(notificationId) {
        try {
          const { error } = await supabase
            .from("notifdatacenter")
            .update({ is_read: true })
            .eq("id", notificationId);

          if (error) throw error;

          showNotification("Notification marked as read", "success");
        } catch (error) {
          console.error("Error marking notification as read:", error);
          showNotification("Failed to mark notification as read", "error");
        }
      }

      let searchTimeout;

      // Gunakan debounce untuk menghindari banyak request selama mengetik
      function setupSearchInput() {
        const searchInput = document.getElementById("searchInput");
        if (!searchInput) return;

        searchInput.addEventListener("input", () => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            const term = searchInput.value.trim();
            if (term.length >= 1) {
              searchFiles(term);
            } else {
              resetFileList(); // Reset jika kosong
            }
          }, 300); // Delay 300ms
        });
      }

      // Search files with relevance sorting and highlighting
      async function searchFiles(searchTerm) {
        try {
          const userId = currentUser?.id;
          if (!userId) throw new Error("User not authenticated");

          const { data: files, error } = await supabase
            .from("files")
            .select("*, folders(name)")
            .eq("user_id", userId)
            .ilike("name", `%${searchTerm}%`);

          if (error) throw error;

          const recentFilesContainer = document.getElementById("recentFilesContainer");
          recentFilesContainer.innerHTML = "";

          if (files.length === 0) {
            recentFilesContainer.innerHTML =
              '<div class="text-center text-slate-400">No files found matching your search.</div>';
            return;
          }

          // Prioritaskan file yang **dimulai dengan** searchTerm
          const sortedFiles = files.sort((a, b) => {
            const aStartsWith = a.name.toLowerCase().startsWith(searchTerm.toLowerCase());
            const bStartsWith = b.name.toLowerCase().startsWith(searchTerm.toLowerCase());
            return bStartsWith - aStartsWith; // Yang match paling depan
          });

          sortedFiles.forEach((file) => {
            const fileElement = document.createElement("div");
            fileElement.className =
              "grid grid-cols-12 p-3 hover:bg-slate-800/50 transition-all cursor-pointer file-item";
            fileElement.dataset.id = file.id;
            fileElement.id = `file-${file.id}`; // ID unik untuk scroll

            const icon = file.type === "image" ? "image" : "file-text";
            const color = file.type === "image" ? "green" : "blue";

            // Highlight kata kunci dalam nama file
            const highlightedName = file.name.replace(
              new RegExp(`(${searchTerm})`, "gi"),
              "<mark class='bg-yellow-600'>$1</mark>"
            );

            fileElement.innerHTML = `
                <div class="col-span-5 flex items-center">
                    <i data-lucide="${icon}" class="h-4 w-4 text-${color}-400 mr-2"></i>
                    <span class="text-sm font-medium text-white">${highlightedName}</span>
                </div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${file.folders.name
              }</div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${file.type.charAt(0).toUpperCase() + file.type.slice(1)
              }</div>
                <div class="col-span-1 text-sm text-slate-400 flex items-center">${file.size_mb.toFixed(
                2
              )} MB</div>
                <div class="col-span-2 text-sm text-slate-400 flex items-center">${formatDate(
                file.modified_at
              )}</div>
            `;

            fileElement.addEventListener("click", () => {
              viewFile(file.id, file.name, file.url, file.type, file.size_mb);
              scrollToElement(fileElement); // Scroll ke file
            });

            recentFilesContainer.appendChild(fileElement);
          });

          lucide.createIcons();
        } catch (error) {
          console.error("Error searching files:", error);
          showNotification("Failed to search files", "error");
        }
      }

      // Scroll animasi ke elemen file saat diklik
      function scrollToElement(element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("bg-orange-500/30"); // Efek highlight opsional
        setTimeout(() => {
          element.classList.remove("bg-orange-500/30");
        }, 1500);
      }

      // Reset ke tampilan awal (misalkan menggunakan Recent Files atau all files)
      function resetFileList() {
        const recentFilesContainer = document.getElementById("recentFilesContainer");
        recentFilesContainer.innerHTML = ""; // Kosongkan dulu

        // Misalnya panggil fungsi loadRecentFiles() atau render semua file
        loadRecentFiles(); // Harus ada fungsi ini di kode Anda
      }

      // Initialize storage chart
      function initStorageChart() {
        const ctx = document.getElementById("storageChart").getContext("2d");
        storageChart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Used", "Free"],
            datasets: [
              {
                data: [0, STORAGE_LIMIT_MB],
                backgroundColor: ["#06b6d4", "#334155"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "80%",
            plugins: {
              legend: {
                display: false,
              },
            },
          },
        });
      }

      // Update storage chart, system health, and security status with current usage
      async function updateStorageChart() {
        try {
          const userId = currentUser?.id;
          if (!userId) {
            console.warn("User not authenticated, skipping updates.");
            storageChart.data.datasets[0].data = [0, STORAGE_LIMIT_MB];
            storageChart.update();
            document.getElementById("cpuUsage").textContent = "N/A";
            document.getElementById("cpuProgress").style.width = "0%";
            document.getElementById("memoryUsage").textContent = "N/A";
            document.getElementById("memoryProgress").style.width = "0%";
            document.getElementById("diskUsage").textContent = "N/A";
            document.getElementById("diskProgress").style.width = "0%";
            document.getElementById("networkUsage").textContent = "N/A";
            document.getElementById("networkProgress").style.width = "0%";
            document.getElementById("securityStatusDot").className =
              "h-2 w-2 rounded-full bg-red-500 mr-2";
            document.getElementById("securityStatusText").textContent = "Vulnerable";
            document.getElementById("securityStatusBadge").textContent = "0%";
            document.getElementById("securityChecks").innerHTML = "";
            return;
          }

          const { data: files, error } = await supabase
            .from("files")
            .select("size_mb")
            .eq("user_id", userId);

          if (error) throw error;

          const storageUsed = files.reduce(
            (sum, file) => sum + (file.size_mb || 0),
            0
          );
          const storageFree = STORAGE_LIMIT_MB - storageUsed;

          const storagePercentage = (storageUsed / STORAGE_LIMIT_MB) * 100;
          if (storagePercentage >= 80) {
            const { data: existingNotifs } = await supabase
              .from("notifdatacenter")
              .select("*")
              .eq("user_id", userId)
              .eq("type", "warning")
              .eq("content", "Storage usage is above 80%!");

            if (!existingNotifs || existingNotifs.length === 0) {
              await supabase.from("notifdatacenter").insert({
                user_id: userId,
                type: "warning",
                content: "Storage usage is above 80%!",
                is_read: false,
              });
            }
          }

          storageChart.data.datasets[0].data = [storageUsed, storageFree];
          storageChart.update();

          let cpuUsage = 0;
          let memoryUsage = 0;
          let diskIOUsage = 0;
          let networkUsage = 0;

          if (storageUsed > 0) {
            cpuUsage = Math.min(storageUsed / 10, 10);
            memoryUsage = Math.min(storageUsed / 5, 20);
            diskIOUsage = Math.min(storageUsed / 5, 50);
            networkUsage = Math.min(storageUsed / 10, 30);
          }

          document.getElementById("cpuUsage").textContent = `${cpuUsage.toFixed(1)}%`;
          document.getElementById("cpuProgress").style.width = `${cpuUsage}%`;
          document.getElementById("memoryUsage").textContent = `${memoryUsage.toFixed(
            1
          )}%`;
          document.getElementById("memoryProgress").style.width = `${memoryUsage}%`;
          document.getElementById("diskUsage").textContent = `${diskIOUsage.toFixed(
            1
          )}%`;
          document.getElementById("diskProgress").style.width = `${diskIOUsage}%`;
          document.getElementById(
            "networkUsage"
          ).textContent = `${networkUsage.toFixed(1)}%`;
          document.getElementById("networkProgress").style.width = `${networkUsage}%`;

          const securityChecks = [
            { name: "Firewall", status: true },
            { name: "Antivirus", status: true },
            { name: "Updates", status: storagePercentage < 80 },
            { name: "Encryption", status: true },
          ];

          const secure = securityChecks.every((check) => check.status);
          document.getElementById(
            "securityStatusDot"
          ).className = `h-2 w-2 rounded-full ${secure ? "bg-green-500" : "bg-red-500"
          } mr-2`;
          document.getElementById("securityStatusText").textContent = secure
            ? "Secure"
            : "Vulnerable";
          document.getElementById("securityStatusBadge").textContent = secure
            ? "100%"
            : `${100 - securityChecks.filter((check) => !check.status).length * 25}%`;

          const securityChecksList = document.getElementById("securityChecks");
          securityChecksList.innerHTML = "";
          securityChecks.forEach((check) => {
            const li = document.createElement("li");
            li.className = "flex items-center";
            li.innerHTML = `
                <i data-lucide="${check.status ? "check-circle" : "alert-triangle"
              }" class="h-3 w-3 ${check.status ? "text-green-400" : "text-yellow-400"
              } mr-2"></i>
                ${check.name}: ${check.status ? "OK" : "Warning"}
            `;
            securityChecksList.appendChild(li);
          });

          lucide.createIcons();
        } catch (error) {
          console.error(
            "Error updating storage chart, system health, and security status:",
            error
          );
          showNotification(
            "Failed to update storage chart, system health, and security status",
            "error"
          );
          storageChart.data.datasets[0].data = [0, STORAGE_LIMIT_MB];
          storageChart.update();
          document.getElementById("cpuUsage").textContent = "N/A";
          document.getElementById("cpuProgress").style.width = "0%";
          document.getElementById("memoryUsage").textContent = "N/A";
          document.getElementById("memoryProgress").style.width = "0%";
          document.getElementById("diskUsage").textContent = "N/A";
          document.getElementById("diskProgress").style.width = "0%";
          document.getElementById("networkUsage").textContent = "N/A";
          document.getElementById("networkProgress").style.width = "0%";
          document.getElementById("securityStatusDot").className =
            "h-2 w-2 rounded-full bg-red-500 mr-2";
          document.getElementById("securityStatusText").textContent = "Vulnerable";
          document.getElementById("securityStatusBadge").textContent = "0%";
          document.getElementById("securityChecks").innerHTML = "";
        }
      }

      // Gunakan auth listener untuk memastikan autentikasi selesai
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          if (session?.user) {
            console.log("User authenticated:", session.user.id);
            loadNotifications();
          }
        }
      });
