/*
 * File: c:\Users\tonyw\Desktop\forks\nvidia-drivers-scrape\assets\script.js
 * Project: c:\Users\tonyw\Desktop\forks\nvidia-drivers-scrape\assets
 * Created Date: Friday October 18th 2024
 * Author: Tony Wiedman
 * -----
 * Last Modified: Fri October 18th 2024 11:12:25 
 * Modified By: Tony Wiedman
 * -----
 * Copyright (c) 2024 MolexWorks
 */


//@ Initialization ----

//! Document Ready
//! \remarks Initializes the page with user preferences and GPU information
document.addEventListener("DOMContentLoaded", () =>
{
    let scheme = localStorage.getItem("color-scheme");
    if (!scheme)
    {
        scheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-scheme", scheme);
    document.getElementById("dark-mode-toggle").textContent = scheme === "dark" ? "☼" : "☾";
    document.getElementById("studio-toggle").textContent = "Show Studio Drivers";
    FetchDriverInfo();

    const gpuInfo = DisplayGPUInfo();
    if (gpuInfo)
    {
        document.getElementById("gpu-info").innerHTML = `Detected <div>${gpuInfo.gpuModel}</div>`;
    } else
    {
        document.getElementById("gpu-info").textContent = 'Could not detect GPU information';
    }
});

//! Fetch Driver Info
//! \remarks Fetches driver information from NVIDIA API (shitty php endpoint i found)
async function FetchDriverInfo()
{
    if (document.getElementById("studio-toggle").textContent === "Hide Studio Drivers") ToggleStudioDrivers();

    try
    {
        const resultsCount = document.getElementById("resultsCountSelect").value;
        const response = await fetch(`https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=127&pfid=1039&osID=135&languageCode=1033&isWHQL=0&beta=null&dltype=-1&dch=1&upCRD=null&qnf=0&ctk=null&sort1=1&numberOfResults=${resultsCount}`);
        if (!response.ok)
        {
            throw new Error("Network response was not ok");
        }
        const data = await response.json();
        DisplayDriverInfo(data);
    } catch (error)
    {
        console.error("Failed to fetch driver information", error);
        document.getElementById("driver-info").innerHTML = "Failed to retrieve driver data. Please try again later.";
    }
}


//@ Display/Render Functions ----

//! Display GPU Info
//! \returns object - GPU information object
function DisplayGPUInfo()
{
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (gl)
    {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo)
        {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

            let gpuModel = renderer;
            const gpuMatch = renderer.match(/NVIDIA.*?GeForce\s.+?\d{3,4}.+?(?=\s\(|$)/i);
            if (gpuMatch)
            {
                gpuModel = gpuMatch[0];
            }

            gpuModel = gpuModel.replace(/^NVIDIA\s*,\s*NVIDIA/i, 'NVIDIA');

            console.log('GPU Model:', gpuModel);
            return { gpuModel };
        }
    }
    return null;
}

//! Display Driver Info
//! \param data - driver data from API
function DisplayDriverInfo(data)
{
    const gpuInfo = DisplayGPUInfo();
    const matchingSeries = gpuInfo ? GetMatchingSeries(gpuInfo.gpuModel) : null;

    if (data && data.Success && data.IDS && data.IDS.length > 0)
    {
        let gameReadyDrivers = [];
        let studioDrivers = [];

        data.IDS.forEach((driver) =>
        {
            const driverInfo = driver.downloadInfo;

            if (driverInfo && driverInfo.Success === "1")
            {
                if (driverInfo.Name.toLowerCase().includes("studio"))
                {
                    studioDrivers.push(driver);
                }
                else
                {
                    gameReadyDrivers.push(driver);
                }
            }
        });

        let driverDetails = "";
        const combinedDrivers = [...gameReadyDrivers, ...studioDrivers];

        if (combinedDrivers.length === 0)
        {
            document.getElementById("driver-info").innerHTML = "No drivers found for the selected number of results.";
            return;
        }

        combinedDrivers.forEach((driver, index) =>
        {
            const driverInfo = driver.downloadInfo;

            if (!driverInfo)
            {
                console.warn("Driver info not available for:", driver);
                return;
            }

            let osNames = driverInfo.OSList.map(os => decodeURIComponent(os.OSName)).join(", ");
            let seriesNames = driverInfo.series.map(series =>
            {
                const seriesName = decodeURIComponent(series.seriesname);
                if (seriesName === matchingSeries)
                {
                    return `<div class="matching-series">${seriesName}</div>`;
                }
                return `<div class="supported-gpu-series">${seriesName}</div>`;
            }).join("");

            let releaseDate = new Date(driverInfo.ReleaseDateTime);
            let timeAgo = GetTimeAgo(releaseDate);

            driverDetails += `
                    <div class="driver-entry ${driverInfo.Name.toLowerCase().includes('studio') ? 'studio-driver' : ''} ${index === 0 ? 'current-driver' : ''}" style="${driverInfo.Name.toLowerCase().includes('studio') ? 'display:none;' : ''}">
                        
                    ${index === 0 ? `<div class="current-tag">current</div>` : ''}
                    
                    <h2>${decodeURIComponent(driverInfo.Name)}</h2>
                        <div class="driver-grid">
                            <div>
                                <div class="driver-label">Version</div>
                                <div>${driverInfo.Version}</div>
                                <div class="driver-label">Operating System</div>
                                <div>${osNames}</div>
                            </div>
                            <div>
                                <div class="driver-label">Release Date</div>
                                <div>${driverInfo.ReleaseDateTime} (${timeAgo})</div>
                                <div class="driver-label">File Size</div>
                                <div>${driverInfo.DownloadURLFileSize}</div>
                            </div>
                        </div>
                        <div class="supported-gpus-container">
                            ${seriesNames}
                        </div>
                        <div class="driver-actions">
                            <a class="view-details" onclick="DisplayModal('${encodeURIComponent(driverInfo.BannerURLGfe)}', '${driverInfo.ReleaseNotes}', '${driverInfo.Name}', '${driverInfo.Version}', '${driverInfo.ReleaseDateTime}', '${timeAgo}')">Info Modal</a>
                            <a href="${driverInfo.DownloadURL}" target="_blank">Download Driver</a>
                        </div>
                    </div>
                `;
        });

        document.getElementById("driver-info").innerHTML = driverDetails || "No driver information available.";

    }
    else
    {
        console.error("Data retrieval failed or no valid drivers found:", data);
        document.getElementById("driver-info").innerHTML = "Failed to retrieve driver data.";
    }
}

//! Display Modal
//! \param bannerURLGfe - URL to banner image
//! \param releaseNotes - HTML formatted release notes
//! \param driverName - driver name
//! \param driverVersion - driver version
//! \param releaseDate - driver release date
//! \param timeAgo - time since release date
function DisplayModal(bannerURLGfe, releaseNotes, driverName, driverVersion, releaseDate, timeAgo)
{
    const modal = document.getElementById("driverModal");
    const modalBanner = document.getElementById("modalBanner");
    const modalPatchNotes = document.getElementById("modalPatchNotes");
    const modalHeader = document.getElementById("modalHeader");

    // header
    modalHeader.innerHTML = `
        <div class="modal-title">
            ${decodeURIComponent(driverName)} <span>${driverVersion}</span>
            <p>${releaseDate} (${timeAgo})</p>
        </div>
    `;

    // banner
    modalBanner.innerHTML = bannerURLGfe ? `
        <iframe 
            src="${decodeURIComponent(bannerURLGfe)}" 
            title="Driver Banner Slider" 
            class="driver-banner-iframe"
            frameborder="0"
            scrolling="no"
        ></iframe>` : "";

    // patch notes
    if (releaseNotes)
    {
        try
        {
            const decodedNotes = decodeURIComponent(releaseNotes);
            modalPatchNotes.innerHTML = decodedNotes;
        } catch (error)
        {
            console.error("Error decoding or inserting release notes HTML:", error);
            modalPatchNotes.innerHTML = "Failed to load patch notes.";
        }
    } else
    {
        modalPatchNotes.innerHTML = "No patch notes available.";
    }

    // close button
    const closeBtn = document.createElement("span");
    closeBtn.classList.add("close");
    closeBtn.innerHTML = "&times;";
    modalHeader.appendChild(closeBtn);

    modal.style.display = "flex";
    closeBtn.onclick = () =>
    {
        modal.style.display = "none";
    };
    window.onclick = (event) =>
    {
        if (event.target === modal)
        {
            modal.style.display = "none";
        }
    };
}


//@ Utility and Helper Functions ----

//! Get Time Ago
//! \param date - date to compare
//! \returns string - time since date
function GetTimeAgo(date)
{
    const now = new Date();
    const diff = Math.abs(now - date);

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1)
    {
        return "just now";
    } else if (minutes < 60)
    {
        return `${minutes} minutes ago`;
    } else if (hours < 24)
    {
        return `${hours} hours ago`;
    } else
    {
        return `${days} days ago`;
    }
}

//! Toggle Dark Mode
//! \remarks Toggles dark mode on the page, saves user preference to local storage
function ToggleDarkMode()
{
    const currentScheme = document.documentElement.getAttribute("data-scheme");
    const newScheme = currentScheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-scheme", newScheme);
    localStorage.setItem("color-scheme", newScheme);
    document.getElementById("dark-mode-toggle").textContent = newScheme === "dark" ? "☼" : "☾";
}

//! Toggle Studio Drivers
//! \remarks Toggles display of studio drivers
function ToggleStudioDrivers()
{
    const studioDrivers = document.querySelectorAll(".studio-driver");
    studioDrivers.forEach(driver =>
    {
        driver.style.display = driver.style.display === "none" ? "flex" : "none";
    });
    const toggleButton = document.getElementById("studio-toggle");
    toggleButton.textContent = toggleButton.textContent === "Show Studio Drivers" ? "Hide Studio Drivers" : "Show Studio Drivers";
}

//! Get Matching Series
//! \param gpuModel - GPU model string
//! \returns string - matching series name
function GetMatchingSeries(gpuModel)
{
    if (gpuModel.includes('RTX 40')) return 'GeForce RTX 40 Series';
    if (gpuModel.includes('RTX 30')) return 'GeForce RTX 30 Series';
    if (gpuModel.includes('RTX 20')) return 'GeForce RTX 20 Series';
    if (gpuModel.includes('16 Series')) return 'GeForce 16 Series';
    if (gpuModel.includes('10')) return 'GeForce 10 Series';
    if (gpuModel.includes('900')) return 'GeForce 900 Series';
    if (gpuModel.includes('700')) return 'GeForce 700 Series';
    if (gpuModel.includes('TITAN')) return 'NVIDIA TITAN Series';
    return null;
}