import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, browserSessionPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// TODO: Replace with your Firebase project config from console.firebase.google.com
const firebaseConfig = {
    apiKey: "AIzaSyCBxKhCYB1ITqhOVFlpmLloSfQaLibijAA",
    authDomain: "underwriting-deal-tracker.firebaseapp.com",
    projectId: "underwriting-deal-tracker",
    storageBucket: "underwriting-deal-tracker.firebasestorage.app",
    messagingSenderId: "896826641817",
    appId: "1:896826641817:web:a34e0e9b566c86eee51708"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEMO_EMAIL = "demo@dealtracker.com";
const DEMO_PASSWORD = "demo1234";

const SEED_DEALS = [
    { dealName: "Maple Heights Apartments", dueDate: "2026-05-20", analyst: "Alex Johnson", associate: "Ian Taylor", state: "TX", guidance: "$3,200,000", status: "underwriting", timestamp: Date.now() },
    { dealName: "Riverside Commons", dueDate: "2026-05-28", analyst: "Ben Carter", associate: "Julia Martinez", state: "FL", guidance: "$4,750,000", status: "underwriting", timestamp: Date.now() },
    { dealName: "Summit Ridge Development", dueDate: "2026-06-05", analyst: "Chris Davis", associate: "Kevin Anderson", state: "CO", guidance: "$2,100,000", status: "underwriting", timestamp: Date.now() },
    { dealName: "Oakwood Plaza", dueDate: "2026-06-12", analyst: "Dana Lee", associate: "Laura Thomas", state: "GA", guidance: "$5,500,000", status: "underwriting", timestamp: Date.now() },
    { dealName: "Pineview Estates", dueDate: "2026-05-15", analyst: "Emma Wilson", associate: "Mike Jackson", state: "AZ", guidance: "$3,800,000", status: "inReview", timestamp: Date.now() - 86400000 },
    { dealName: "Harbor View Lofts", dueDate: "2026-05-18", analyst: "Frank Miller", associate: "Nancy White", state: "CA", guidance: "$6,200,000", status: "inReview", timestamp: Date.now() - 86400000 },
    { dealName: "Greenfield Townhomes", dueDate: "2026-04-30", analyst: "Grace Chen", associate: "Oscar Harris", state: "WA", guidance: "$2,900,000", status: "sentLoi", timestamp: Date.now() - 172800000 },
    { dealName: "Willowbrook Center", dueDate: "2026-04-22", analyst: "Henry Brown", associate: "Paula Robinson", state: "IL", guidance: "$4,100,000", status: "sentLoi", timestamp: Date.now() - 172800000 },
    { dealName: "Canyon Ridge Apartments", dueDate: "2026-04-10", analyst: "Alex Johnson", associate: "Ian Taylor", state: "NV", guidance: "$3,500,000", status: "passed", timestamp: Date.now() - 259200000 },
    { dealName: "Lakefront Residences", dueDate: "2026-04-05", analyst: "Chris Davis", associate: "Kevin Anderson", state: "MN", guidance: "$7,800,000", status: "passed", timestamp: Date.now() - 345600000 },
    { dealName: "Brookside Village", dueDate: "2026-03-28", analyst: "Emma Wilson", associate: "Laura Thomas", state: "NC", guidance: "$1,950,000", status: "passed", timestamp: Date.now() - 432000000 }
];

let deals = [];

document.addEventListener('DOMContentLoaded', () => {

    const loginModal = document.getElementById('loginModal');
    const appMainContent = document.getElementById('app-main-content');
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const passwordToggle = document.getElementById('password-toggle');
    const logoutButton = document.getElementById('logoutButton');
    const searchInput = document.getElementById('searchDeals');

    // Pre-fill demo credentials
    loginEmailInput.value = DEMO_EMAIL;
    loginPasswordInput.value = DEMO_PASSWORD;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loginModal.classList.remove('is-active');
            appMainContent.classList.remove('is-hidden');
            await seedDemoDataIfEmpty();
            await fetchDeals();
            renderDeals();
        } else {
            loginModal.classList.add('is-active');
            appMainContent.classList.add('is-hidden');
            deals = [];
            renderDeals();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorMessage.classList.add('is-hidden');
        await setPersistence(auth, browserSessionPersistence);
        try {
            await signInWithEmailAndPassword(auth, loginEmailInput.value, loginPasswordInput.value);
        } catch (error) {
            loginErrorMessage.classList.remove('is-hidden');
            loginPasswordInput.value = '';
            setTimeout(() => loginErrorMessage.classList.add('is-hidden'), 3000);
        }
    });

    passwordToggle.addEventListener('click', () => {
        const isPassword = loginPasswordInput.getAttribute('type') === 'password';
        loginPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');
        passwordToggle.querySelector('i').classList.toggle('fa-eye-slash');
        passwordToggle.querySelector('i').classList.toggle('fa-eye');
    });

    logoutButton.addEventListener('click', () => signOut(auth));

    // --- Team Members ---
    const analysts = [
        "Alex Johnson", "Ben Carter", "Chris Davis", "Dana Lee",
        "Emma Wilson", "Frank Miller", "Grace Chen", "Henry Brown", "     "
    ].sort();

    const associatesAndDirectors = [
        ...analysts,
        "Ian Taylor", "Julia Martinez", "Kevin Anderson", "Laura Thomas",
        "Mike Jackson", "Nancy White", "Oscar Harris", "Paula Robinson"
    ].sort();

    // --- Sort State ---
    const sortState = {
        underwriting: { column: null, direction: null },
        inReview: { column: null, direction: null },
        sentLoi: { column: null, direction: null },
        passed: { column: null, direction: null }
    };

    const sections = {
        underwriting: document.getElementById('underwritingTableBody').closest('.section'),
        inReview: document.getElementById('inReviewTableBody').closest('.section'),
        sentLoi: document.getElementById('sentLoiTableBody').closest('.section'),
        passed: document.getElementById('passedTableBody').closest('.section')
    };

    // --- Column Sort Headers ---
    document.querySelectorAll('th[data-column]').forEach(header => {
        header.addEventListener('click', () => sortTable(header.dataset.status, header.dataset.column));
    });

    // --- Add Deal Modal ---
    const dealModal = document.getElementById('dealModal');
    document.getElementById('openAddDealForm').addEventListener('click', () => dealModal.classList.add('is-active'));
    document.getElementById('closeModalButton').addEventListener('click', () => { dealModal.classList.remove('is-active'); clearForm(); });
    document.getElementById('cancelButton').addEventListener('click', () => { dealModal.classList.remove('is-active'); clearForm(); });
    dealModal.querySelector('.modal-background').addEventListener('click', () => { dealModal.classList.remove('is-active'); clearForm(); });
    document.getElementById('addDealButton').addEventListener('click', addDeal);

    dealModal.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addDeal(); } });
    });

    document.getElementById('state').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

    searchInput.addEventListener('input', e => renderDeals(e.target.value.toLowerCase()));

    document.addEventListener('click', e => {
        document.querySelectorAll('.dropdown.is-active').forEach(d => {
            if (!d.contains(e.target)) d.classList.remove('is-active');
        });
    });

    // --- Firestore ---
    async function seedDemoDataIfEmpty() {
        const snapshot = await getDocs(collection(db, "deals"));
        if (snapshot.empty) {
            await Promise.all(SEED_DEALS.map(deal => addDoc(collection(db, "deals"), deal)));
        }
    }

    async function fetchDeals() {
        const snapshot = await getDocs(collection(db, "deals"));
        deals = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function addDeal() {
        const requiredFields = ["dealName", "dueDate", "associate", "state"];
        let isValid = true;

        requiredFields.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove("is-danger");
            if (el.parentNode.classList.contains('select')) el.parentNode.classList.remove("is-danger");
        });

        requiredFields.forEach(id => {
            const el = document.getElementById(id);
            if (!el.value) {
                el.classList.add("is-danger");
                if (el.parentNode.classList.contains('select')) el.parentNode.classList.add("is-danger");
                isValid = false;
            }
        });

        if (!isValid) return;

        const newDeal = {
            dealName: document.getElementById("dealName").value,
            dueDate: document.getElementById("dueDate").value,
            analyst: document.getElementById("analyst").value,
            associate: document.getElementById("associate").value,
            state: document.getElementById("state").value,
            guidance: formatGuidance(document.getElementById("guidance").value),
            status: "underwriting",
            timestamp: Date.now()
        };

        try {
            await addDoc(collection(db, "deals"), newDeal);
            await fetchDeals();
            renderDeals();
        } catch (e) {
            alert("Failed to add deal. Check the console for more details.");
            return;
        }

        clearForm();
        dealModal.classList.remove('is-active');

        const toast = document.createElement('div');
        toast.className = 'notification is-success is-light';
        toast.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:2000;';
        toast.textContent = 'Deal added successfully!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    async function moveDeal(id, newStatus) {
        await updateDoc(doc(db, "deals", id), { status: newStatus });
        await fetchDeals();
        renderDeals(searchInput.value.toLowerCase());
    }

    async function deleteDeal(id) {
        if (!confirm("Are you sure you want to delete this deal?")) return;
        await deleteDoc(doc(db, "deals", id));
        await fetchDeals();
        renderDeals(searchInput.value.toLowerCase());
    }

    // --- Render ---
    function renderDeals(searchTerm = '') {
        const bodies = {
            underwriting: document.getElementById("underwritingTableBody"),
            inReview: document.getElementById("inReviewTableBody"),
            sentLoi: document.getElementById("sentLoiTableBody"),
            passed: document.getElementById("passedTableBody")
        };

        Object.values(bodies).forEach(b => { if (b) b.innerHTML = ""; });

        const dealsByStatus = { underwriting: [], inReview: [], sentLoi: [], passed: [] };
        deals.forEach(deal => { if (dealsByStatus[deal.status]) dealsByStatus[deal.status].push(deal); });

        Object.keys(dealsByStatus).forEach(status => {
            let filtered = dealsByStatus[status].filter(deal =>
                [deal.dealName, deal.analyst, deal.associate, deal.state]
                    .some(v => v && v.toLowerCase().includes(searchTerm))
            );

            if (status === 'passed' && !searchTerm) {
                filtered.sort((a, b) => b.timestamp - a.timestamp);
                filtered = filtered.slice(0, 15);
            }

            const current = sortState[status];
            if (current.column) {
                filtered.sort((a, b) => {
                    let av = a[current.column];
                    let bv = b[current.column];
                    if (current.column === 'guidance') { av = parseFloat(stripFormatting(av)); bv = parseFloat(stripFormatting(bv)); }
                    if (current.column === 'dueDate') { av = new Date(av); bv = new Date(bv); }
                    if (av < bv) return current.direction === 'asc' ? -1 : 1;
                    if (av > bv) return current.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            const body = bodies[status];
            if (filtered.length > 0 || !searchTerm) {
                if (sections[status]) sections[status].style.display = 'block';
                filtered.forEach(deal => body.appendChild(createDealRow(deal, status)));
            } else {
                if (sections[status]) sections[status].style.display = 'none';
            }

            for (let i = 0; i < 5; i++) {
                const blankRow = document.createElement("tr");
                if (status === 'passed' && !searchTerm && i === 2) {
                    const cell = document.createElement("td");
                    cell.setAttribute('colspan', '7');
                    cell.className = 'has-text-centered has-text-danger is-italic';
                    cell.textContent = 'Some passed deals are hidden once list gets too long — use the search bar to find them.';
                    blankRow.appendChild(cell);
                } else {
                    for (let j = 0; j < 7; j++) {
                        const cell = document.createElement("td");
                        cell.innerHTML = '&nbsp;';
                        blankRow.appendChild(cell);
                    }
                }
                body.appendChild(blankRow);
            }
        });
    }

    function createDealRow(deal, status) {
        const row = document.createElement("tr");
        row.dataset.id = deal.id;

        const [year, month, day] = deal.dueDate.split('-');
        const formattedDate = `${parseInt(month)}/${parseInt(day)}/${year.slice(-2)}`;
        const properties = ['dealName', 'dueDate', 'analyst', 'associate', 'state', 'guidance'];
        const displayValues = [deal.dealName, formattedDate, deal.analyst, deal.associate, deal.state, deal.guidance];

        displayValues.forEach((val, i) => {
            const cell = document.createElement("td");
            cell.textContent = val;
            cell.dataset.property = properties[i];
            cell.addEventListener('dblclick', editDealCell);
            row.appendChild(cell);
        });

        const actionsCell = document.createElement("td");
        actionsCell.className = "has-text-centered";

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown is-right';

        const trigger = document.createElement('div');
        trigger.className = 'dropdown-trigger';

        const btn = document.createElement("button");
        btn.className = "button is-small is-light";
        btn.setAttribute('aria-haspopup', 'true');
        btn.innerHTML = `<span class="icon is-small"><i class="fas fa-ellipsis-v"></i></span>`;
        btn.addEventListener("click", e => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown.is-active').forEach(d => { if (d !== dropdown) d.classList.remove('is-active'); });
            dropdown.classList.toggle('is-active');
        });

        trigger.appendChild(btn);

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.setAttribute('role', 'menu');
        const content = document.createElement('div');
        content.className = 'dropdown-content';

        const statusLabels = { underwriting: "Underwriting", inReview: "In Review", sentLoi: "Sent LOI", passed: "Passed Deals" };
        Object.keys(statusLabels).filter(s => s !== status).forEach(s => {
            const a = document.createElement("a");
            a.className = "dropdown-item";
            a.textContent = `Move to ${statusLabels[s]}`;
            a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); moveDeal(deal.id, s); dropdown.classList.remove('is-active'); });
            content.appendChild(a);
        });

        const divider = document.createElement('hr');
        divider.className = 'dropdown-divider';
        content.appendChild(divider);

        const delBtn = document.createElement('a');
        delBtn.className = 'dropdown-item has-text-danger';
        delBtn.textContent = 'Delete Deal';
        delBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); deleteDeal(deal.id); dropdown.classList.remove('is-active'); });
        content.appendChild(delBtn);

        menu.appendChild(content);
        dropdown.appendChild(trigger);
        dropdown.appendChild(menu);
        actionsCell.appendChild(dropdown);
        row.appendChild(actionsCell);
        return row;
    }

    async function editDealCell(event) {
        const cell = event.currentTarget;
        const row = cell.closest('tr');
        const dealId = row.dataset.id;
        const deal = deals.find(d => d.id === dealId);
        if (!deal || cell.cellIndex >= 6) return;

        const propMap = ['dealName', 'dueDate', 'analyst', 'associate', 'state', 'guidance'];
        const propertyName = propMap[cell.cellIndex];
        const originalValue = deal[propertyName];

        cell.innerHTML = '';
        let inputEl;

        if (propertyName === 'dueDate') {
            inputEl = document.createElement('input');
            inputEl.type = 'date';
            inputEl.value = originalValue;
            inputEl.className = 'input is-small';
        } else if (propertyName === 'analyst' || propertyName === 'associate') {
            const wrapper = document.createElement('div');
            wrapper.className = 'select is-fullwidth is-small';
            inputEl = document.createElement('select');
            const opts = propertyName === 'analyst' ? analysts : associatesAndDirectors;
            opts.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o;
                opt.textContent = o;
                if (o === originalValue) opt.selected = true;
                inputEl.appendChild(opt);
            });
            wrapper.appendChild(inputEl);
            cell.appendChild(wrapper);
        } else {
            inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'input is-small';
            inputEl.value = propertyName === 'guidance' ? stripFormatting(originalValue) : originalValue;
            if (propertyName === 'state') inputEl.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
        }

        if (!cell.contains(inputEl)) cell.appendChild(inputEl);
        inputEl.focus();

        const save = async () => {
            let newValue = inputEl.value;
            if (propertyName === 'state') newValue = newValue.toUpperCase();
            if (propertyName === 'guidance') newValue = formatGuidance(newValue);
            try {
                await updateDoc(doc(db, "deals", dealId), { [propertyName]: newValue });
                await fetchDeals();
                renderDeals(searchInput.value.toLowerCase());
            } catch (e) {
                console.error("Error updating document:", e);
            }
        };

        inputEl.addEventListener('blur', save);
        inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') inputEl.blur(); });
    }

    function sortTable(status, column) {
        if (sortState[status].column === column) {
            sortState[status].direction = sortState[status].direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState[status].column = column;
            sortState[status].direction = 'asc';
        }

        document.querySelectorAll(`[data-status="${status}"] .sort-icon`).forEach(icon => icon.classList.remove('active', 'rotated'));

        const header = document.querySelector(`[data-status="${status}"][data-column="${column}"]`);
        if (header) {
            const icon = header.querySelector('.sort-icon');
            if (icon) {
                icon.classList.add('active');
                if (sortState[status].direction === 'desc') icon.classList.add('rotated');
            }
        }
        renderDeals(searchInput.value.toLowerCase());
    }

    function clearForm() {
        ["dealName", "dueDate", "analyst", "associate", "state", "guidance"].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = "";
                el.classList.remove("is-danger");
                if (el.parentNode.classList.contains('select')) el.parentNode.classList.remove("is-danger");
            }
        });
    }

    function formatGuidance(value) {
        if (!value) return '';
        const num = parseFloat(String(value).replace(/[$,]/g, ''));
        return isNaN(num) ? '' : '$' + num.toLocaleString('en-US');
    }

    function stripFormatting(value) {
        return value ? String(value).replace(/[$,]/g, '') : '';
    }

    populateDropdown("analyst", analysts, "Select Analyst");
    populateDropdown("associate", associatesAndDirectors, "Select Associate / Director");

    function populateDropdown(id, options, placeholder) {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = placeholder;
        defaultOpt.selected = true;
        select.appendChild(defaultOpt);
        options.forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
    }
});
