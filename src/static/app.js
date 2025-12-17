document.addEventListener('DOMContentLoaded', () => {
  const activitiesList = document.getElementById('activities-list');
  const activitySelect = document.getElementById('activity');
  const signupForm = document.getElementById('signup-form');
  const messageDiv = document.getElementById('message');

  function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = ''; // reset classes
    messageDiv.classList.add('message', type);
    messageDiv.classList.remove('hidden');
    setTimeout(() => messageDiv.classList.add('hidden'), 4000);
  }

  function createParticipantLi(activityName, email) {
    const li = document.createElement('li');
    li.className = 'participant-item';

    const span = document.createElement('span');
    span.className = 'participant-email-text';
    span.textContent = email;
    li.appendChild(span);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-participant';
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', `Remove ${email}`);
    delBtn.title = 'Remove participant';
    delBtn.textContent = '✖';

    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove ${email} from ${activityName}?`)) return;
      try {
        const res = await fetch(`/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
        const payload = await res.json();
        if (!res.ok) {
          showMessage(payload.detail || 'Failed to remove participant', 'error');
          return;
        }
        // remove from DOM
        li.remove();

        // If list empty, show placeholder
        const card = Array.from(document.querySelectorAll('.activity-card'))
          .find(c => c.querySelector('h4').textContent === activityName);
        if (card) {
          const ul = card.querySelector('.participants-list');
          if (ul && ul.children.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'no-participants';
            empty.textContent = 'No participants yet';
            ul.appendChild(empty);
          }

          // Update heading and capacity
          const heading = card.querySelector('.participants-section h5');
          const match = heading.textContent.match(/\((\d+)\)/);
          const newCount = match ? Math.max(0, parseInt(match[1], 10) - 1) : (ul.children.length);
          heading.textContent = `Participants (${newCount})`;
          const cap = card.querySelector('p:nth-of-type(3)');
          if (cap) {
            const maxMatch = cap.textContent.match(/\/\s*(\d+)/);
            if (maxMatch) cap.textContent = `Capacity: ${newCount} / ${maxMatch[1]}`;
          }
        }

        showMessage(payload.message || 'Removed participant', 'success');
      } catch (err) {
        showMessage('Network error while removing participant', 'error');
      }
    });

    li.appendChild(delBtn);
    return li;
  }

  async function loadActivities() {
    activitiesList.innerHTML = '<p>Loading activities...</p>';
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
    try {
      const res = await fetch('/activities');
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data = await res.json();
      activitiesList.innerHTML = '';
      for (const [name, info] of Object.entries(data)) {
        // Activity card
        const card = document.createElement('div');
        card.className = 'activity-card';

        const title = document.createElement('h4');
        title.textContent = name;
        card.appendChild(title);

        const desc = document.createElement('p');
        desc.textContent = info.description;
        card.appendChild(desc);

        const sched = document.createElement('p');
        sched.textContent = `Schedule: ${info.schedule}`;
        card.appendChild(sched);

        const capacity = document.createElement('p');
        capacity.textContent = `Capacity: ${info.participants.length} / ${info.max_participants}`;
        card.appendChild(capacity);

        // Participants section
        const participantsSection = document.createElement('div');
        participantsSection.className = 'participants-section';

        const pHeading = document.createElement('h5');
        pHeading.textContent = `Participants (${info.participants.length})`;
        participantsSection.appendChild(pHeading);

        const ul = document.createElement('ul');
        ul.className = 'participants-list';

        if (info.participants.length === 0) {
          const li = document.createElement('li');
          li.className = 'no-participants';
          li.textContent = 'No participants yet';
          ul.appendChild(li);
        } else {
          info.participants.forEach(email => {
            ul.appendChild(createParticipantLi(name, email));
          });
        }

        participantsSection.appendChild(ul);
        card.appendChild(participantsSection);

        activitiesList.appendChild(card);

        // Add to select
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        activitySelect.appendChild(opt);
      }
    } catch (err) {
      activitiesList.innerHTML = '<p class="error">Failed to load activities.</p>';
    }
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const selected = activitySelect.value;
    if (!selected) {
      showMessage('Please select an activity', 'error');
      return;
    }
    try {
      const res = await fetch(
        `/activities/${encodeURIComponent(selected)}/signup?email=${encodeURIComponent(email)}`,
        { method: 'POST' }
      );
      const payload = await res.json();
      if (!res.ok) {
        showMessage(payload.detail || 'Signup failed', 'error');
        return;
      }
      showMessage(payload.message || 'Signed up successfully', 'success');

      // Update DOM participants list for the activity
      const cards = Array.from(document.querySelectorAll('.activity-card'));
      const card = cards.find(c => c.querySelector('h4').textContent === selected);
      if (card) {
        const ul = card.querySelector('.participants-list');
        const no = ul.querySelector('.no-participants');
        if (no) no.remove();
        ul.appendChild(createParticipantLi(selected, email));
        // Update heading and capacity
        const heading = card.querySelector('.participants-section h5');
        const match = heading.textContent.match(/\((\d+)\)/);
        const newCount = match ? parseInt(match[1], 10) + 1 : ul.children.length;
        heading.textContent = `Participants (${newCount})`;
        const cap = card.querySelector('p:nth-of-type(3)');
        if (cap) {
          // extract max from text and update current count
          const maxMatch = cap.textContent.match(/\/\s*(\d+)/);
          if (maxMatch) {
            cap.textContent = `Capacity: ${newCount} / ${maxMatch[1]}`;
          }
        }
      }
      signupForm.reset();
    } catch (err) {
      showMessage('Network error during signup', 'error');
    }
  });

  loadActivities();
});
