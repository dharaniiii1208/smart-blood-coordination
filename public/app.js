
const form = document.getElementById('requestForm');
const table = document.getElementById('requestTable');
const messageBox = document.getElementById('message');
const submitButton = document.getElementById('submitButton');

function showMessage(message, type = 'success') {
    messageBox.textContent = message;
    messageBox.className = `alert alert-${type}`;
}

async function loadHospitals() {
    const response = await fetch('/api/hospitals');
    if (!response.ok) throw new Error('Could not load hospitals.');

    const hospitals = await response.json();
    const select = document.getElementById('hospital_id');

    select.replaceChildren(new Option('Select hospital', ''));

    hospitals.forEach(hospital => {
        const option = new Option(
            `${hospital.hospital_name} — ${hospital.address || 'Address unavailable'}`,
            hospital.hospital_id
        );
        select.add(option);
    });

    document.getElementById('hospitalCount').textContent = hospitals.length;
}

async function loadRequests() {
    table.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const response = await fetch('/api/requests');
        if (!response.ok) throw new Error('Could not load requests.');

        const requests = await response.json();

        document.getElementById('totalCount').textContent = requests.length;
        document.getElementById('pendingCount').textContent =
            requests.filter(r => r.request_status === 'PENDING').length;

        table.replaceChildren();

        if (requests.length === 0) {
            table.innerHTML = '<tr><td colspan="5" class="text-center">No requests yet.</td></tr>';
            return;
        }

        requests.forEach(request => {
            const row = document.createElement('tr');

            [
                request.patient_name,
                request.blood_group,
                request.units_required,
                request.hospital_name || 'Not assigned'
            ].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            const statusCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'status';
            badge.textContent = request.request_status;
            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            table.appendChild(row);
        });
    } catch (error) {
        table.innerHTML = '<tr><td colspan="5">Could not load requests. Check the server.</td></tr>';
        console.error(error);
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    submitButton.disabled = true;

    const payload = {
        patient_name: document.getElementById('patient_name').value.trim(),
        blood_group: document.getElementById('blood_group').value,
        units_required: Number(document.getElementById('units_required').value),
        hospital_id: Number(document.getElementById('hospital_id').value)
    };

    try {
        const response = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Request submission failed.');
        }

        showMessage(`Request #${result.requestId} saved successfully!`);
        form.reset();
        document.getElementById('units_required').value = 1;

        await loadRequests();
    } catch (error) {
        showMessage(error.message, 'danger');
    } finally {
        submitButton.disabled = false;
    }
});

document.getElementById('refreshButton').addEventListener('click', loadRequests);

async function initializeDashboard() {
    try {
        await loadHospitals();
        await loadRequests();
    } catch (error) {
        showMessage('Could not load dashboard data. Check the server and database.', 'danger');
        console.error(error);
    }
}

initializeDashboard();
