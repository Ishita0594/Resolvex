import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('states plainly that this is not a fraud-detection system', () => {
    renderLanding();
    expect(screen.getByText(/is not a fraud-detection system/i)).toBeInTheDocument();
  });

  it('shows a benefit for each of the three stakeholders', () => {
    renderLanding();
    expect(screen.getByText('Card members')).toBeInTheDocument();
    expect(screen.getByText('Merchants')).toBeInTheDocument();
    expect(screen.getByText('Analysts & issuers')).toBeInTheDocument();
  });

  it('previews the workflow from dispute filed through to a decision', () => {
    renderLanding();
    expect(screen.getByText('Dispute filed')).toBeInTheDocument();
    expect(screen.getByText('Decision or human review')).toBeInTheDocument();
  });

  it('links to the login page', () => {
    renderLanding();
    const loginLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    loginLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });
});
