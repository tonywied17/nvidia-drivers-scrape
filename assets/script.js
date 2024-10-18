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
    fetchDriverInfo();

    const gpuInfo = getGPUInfo();
    if (gpuInfo)
    {
        document.getElementById("gpu-info").innerHTML = `Detected <div>${gpuInfo.gpuModel}</div>`;
    } else
    {
        document.getElementById("gpu-info").textContent = 'Could not detect GPU information';
    }
});

function toggleDarkMode()
{
    const currentScheme = document.documentElement.getAttribute("data-scheme");
    const newScheme = currentScheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-scheme", newScheme);
    localStorage.setItem("color-scheme", newScheme);
    document.getElementById("dark-mode-toggle").textContent = newScheme === "dark" ? "☼" : "☾";
}

function toggleStudioDrivers()
{
    const studioDrivers = document.querySelectorAll(".studio-driver");
    studioDrivers.forEach(driver =>
    {
        driver.style.display = driver.style.display === "none" ? "flex" : "none";
    });
    const toggleButton = document.getElementById("studio-toggle");
    toggleButton.textContent = toggleButton.textContent === "Show Studio Drivers" ? "Hide Studio Drivers" : "Show Studio Drivers";
}

async function fetchDriverInfo()
{
    if (document.getElementById("studio-toggle").textContent === "Hide Studio Drivers") toggleStudioDrivers();

    try
    {
        const resultsCount = document.getElementById("resultsCountSelect").value;
        const response = await fetch(`https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=127&pfid=1039&osID=135&languageCode=1033&isWHQL=0&beta=null&dltype=-1&dch=1&upCRD=null&qnf=0&ctk=null&sort1=1&numberOfResults=${resultsCount}`);
        if (!response.ok)
        {
            throw new Error("Network response was not ok");
        }
        const data = await response.json();
        displayDriverInfo(data);
    } catch (error)
    {
        console.error("Failed to fetch driver information", error);
        document.getElementById("driver-info").innerHTML = "Failed to retrieve driver data. Please try again later.";
    }
}

function getGPUInfo()
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

function getMatchingSeries(gpuModel)
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

function displayDriverInfo(data)
{
    const gpuInfo = getGPUInfo();
    const matchingSeries = gpuInfo ? getMatchingSeries(gpuInfo.gpuModel) : null;

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
            let timeAgo = getTimeAgo(releaseDate);

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
                            <a class="view-details" onclick="openModal('${encodeURIComponent(driverInfo.BannerURLGfe)}', '${driverInfo.ReleaseNotes}', '${driverInfo.Name}', '${driverInfo.Version}', '${driverInfo.ReleaseDateTime}', '${timeAgo}')">Info Modal</a>
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


function openModal(bannerURLGfe, releaseNotes, driverName, driverVersion, releaseDate, timeAgo)
{
    const modal = document.getElementById("driverModal");
    const modalBanner = document.getElementById("modalBanner");
    const modalPatchNotes = document.getElementById("modalPatchNotes");
    const modalHeader = document.getElementById("modalHeader");

    modalHeader.innerHTML = `
        <h2>${decodeURIComponent(driverName)}</h2>
        <p>Version: ${driverVersion}</p>
        <p>Release Date: ${releaseDate} (${timeAgo})</p>
    `;

    modalBanner.innerHTML = bannerURLGfe ? `
        <iframe 
            src="${decodeURIComponent(bannerURLGfe)}" 
            title="Driver Banner Slider" 
            class="driver-banner-iframe"
            frameborder="0"
            scrolling="no"
        ></iframe>` : "";

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

    modal.style.display = "block";
}


document.addEventListener("DOMContentLoaded", () =>
{
    const modal = document.getElementById("driverModal");
    const closeBtn = document.querySelector(".close");

    closeBtn.onclick = () =>
    {
        modal.style.display = "none";
    }

    window.onclick = (event) =>
    {
        if (event.target === modal)
        {
            modal.style.display = "none";
        }
    }
});

function getTimeAgo(date)
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

