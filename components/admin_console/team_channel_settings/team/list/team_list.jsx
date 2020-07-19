// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import {debounce} from 'mattermost-redux/actions/helpers';

import {browserHistory} from 'utils/browser_history';

import * as Utils from 'utils/utils.jsx';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import {PAGE_SIZE} from 'components/admin_console/team_channel_settings/abstract_list.jsx';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import './team_list.scss';

const ROW_HEIGHT = 80;
export default class TeamList extends React.PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            searchTeams: PropTypes.func.isRequired,
            getData: PropTypes.func.isRequired,
        }).isRequired,
        data: PropTypes.array,
        total: PropTypes.number,
    };

    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            term: '',
            teams: [],
            page: 0,
            total: 0,
            searchErrored: false,
            filters: {},
        };
    }

    componentDidMount() {
        this.loadPage();
    }

    isSearching = (term, filters) => {
        return (term.length + Object.keys(filters).length) > 0;
    }

    getPaginationProps = () => {
        const {page, term, filters} = this.state;
        const total = this.isSearching(term, filters) ? this.state.total : this.props.total;
        const startCount = (page * PAGE_SIZE) + 1;
        let endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;
        return {startCount, endCount, total};
    }

    loadPage = async (page = 0, term = '', filters = {}) => {
        this.setState({loading: true, term, filters});

        if (this.isSearching(term, filters)) {
            if (page > 0) {
                this.searchTeams(page, term, filters);
            } else {
                this.searchTeamsDebounced(page, term, filters);
            }
            return;
        }

        await this.props.actions.getData(page, PAGE_SIZE);
        this.setState({page, loading: false});
    }

    searchTeams = async (page = 0, term = '', filters = {}) => {
        let teams = [];
        let total = 0;
        let searchErrored = true;
        const response = await this.props.actions.searchTeams(term, {page, per_page: PAGE_SIZE, ...filters});
        if (response?.data) {
            teams = page > 0 ? this.state.teams.concat(response.data.teams) : response.data.teams;
            total = response.data.total_count;
            searchErrored = false;
        }
        this.setState({page, loading: false, teams, total, searchErrored});
    }

    searchTeamsDebounced = debounce((page, term, filters = {}) => this.searchTeams(page, term, filters), 300);

    nextPage = () => {
        this.loadPage(this.state.page + 1, this.state.term, this.state.filters);
    }

    previousPage = () => {
        this.setState({page: this.state.page - 1});
    }

    search = (term) => {
        this.loadPage(0, term);
    };

    onFilter = (filterOptions) => {
        const filters = {};
        const {group_constrained, allow_open_invite, invite_only} = filterOptions.management.values; // eslint-disable-line camelcase, @typescript-eslint/camelcase
        const allowOpenInvite = allow_open_invite.value; // eslint-disable-line camelcase, @typescript-eslint/camelcase
        const inviteOnly = invite_only.value; // eslint-disable-line camelcase, @typescript-eslint/camelcase
        const groupConstrained = group_constrained.value; // eslint-disable-line camelcase, @typescript-eslint/camelcase
        const filtersList = [allowOpenInvite, inviteOnly, groupConstrained];

        // If all filters or no filters do nothing
        if (filtersList.includes(false) && filtersList.includes(true)) {
            if (inviteOnly) {
                filters.exclude_allow_open_invite = !allowOpenInvite;
                filters.exclude_group_constrained = !groupConstrained;
                filters.include_group_constrained = groupConstrained;
            } else if (allowOpenInvite) {
                filters.allow_open_invite = true;
                filters.include_group_constrained = groupConstrained;
            } else {
                filters.group_constrained = true;
            }
        }

        this.loadPage(0, this.state.term, filters);
    }

    getColumns = () => {
        const name = (
            <FormattedMessage
                id='admin.team_settings.team_list.nameHeader'
                defaultMessage='Name'
            />
        );
        const management = (
            <FormattedMessage
                id='admin.team_settings.team_list.mappingHeader'
                defaultMessage='Management'
            />
        );

        return [
            {
                name,
                field: 'name',
                width: 4,
                fixed: true,
            },
            {
                name: management,
                field: 'management',
                fixed: true,
            },
            {
                name: '',
                field: 'edit',
                textAlign: 'right',
                fixed: true,
            },
        ];
    }

    renderManagementMethodText = (team) => {
        if (team.group_constrained) {
            return (
                <FormattedMessage
                    id='admin.team_settings.team_row.managementMethod.groupSync'
                    defaultMessage='Group Sync'
                />
            );
        } else if (team.allow_open_invite) {
            return (
                <FormattedMessage
                    id='admin.team_settings.team_row.managementMethod.anyoneCanJoin'
                    defaultMessage='Anyone Can Join'
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.team_settings.team_row.managementMethod.inviteOnly'
                defaultMessage='Invite Only'
            />
        );
    }

    getRows = () => {
        const {data} = this.props;
        const {term, teams, filters} = this.state;
        const {startCount, endCount} = this.getPaginationProps();
        let teamsToDisplay = this.isSearching(term, filters) ? teams : data;
        teamsToDisplay = teamsToDisplay.slice(startCount - 1, endCount);

        return teamsToDisplay.map((team) => {
            return {
                cells: {
                    id: team.id,
                    name: (
                        <div className='TeamList_nameColumn'>
                            <div className='TeamList__lowerOpacity'>
                                <TeamIcon
                                    size='sm'
                                    url={Utils.imageURLForTeam(team)}
                                    name={team.display_name}
                                />
                            </div>
                            <div className='TeamList_nameText'>
                                <b data-testid='team-display-name'>
                                    {team.display_name}
                                </b>
                                {team.description && (
                                    <div className='TeamList_descriptionText'>
                                        {team.description}
                                    </div>
                                )}
                            </div>
                        </div>
                    ),
                    management: (
                        <span className='TeamList_managementText'>
                            {this.renderManagementMethodText(team)}
                        </span>
                    ),
                    edit: (
                        <span
                            data-testid={`${team.display_name}edit`}
                            className='group-actions TeamList_editText'
                        >
                            <Link to={`/admin_console/user_management/teams/${team.id}`}>
                                <FormattedMessage
                                    id='admin.team_settings.team_row.configure'
                                    defaultMessage='Edit'
                                />
                            </Link>
                        </span>
                    ),
                },
                onClick: () => browserHistory.push(`/admin_console/user_management/teams/${team.id}`),
            };
        });
    }

    render() {
        const {term, searchErrored} = this.state;
        const rows = this.getRows();
        const columns = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        let placeholderEmpty = (
            <FormattedMessage
                id='admin.team_settings.team_list.no_teams_found'
                defaultMessage='No teams found'
            />
        );

        if (searchErrored) {
            placeholderEmpty = (
                <FormattedMessage
                    id='admin.team_settings.team_list.search_teams_errored'
                    defaultMessage='Something went wrong. Try again'
                />
            );
        }

        const filterOptions = {
            management: {
                name: (
                    <FormattedMessage
                        id='admin.team_settings.team_list.mappingHeader'
                        defaultMessage='Management'
                    />
                ),
                values: {
                    allow_open_invite: {
                        name: (
                            <FormattedMessage
                                id='admin.team_settings.team_row.managementMethod.anyoneCanJoin'
                                defaultMessage='Anyone Can Join'
                            />
                        ),
                        value: false,
                    },
                    invite_only: {
                        name: (
                            <FormattedMessage
                                id='admin.team_settings.team_row.managementMethod.inviteOnly'
                                defaultMessage='Invite Only'
                            />
                        ),
                        value: false,
                    },
                    group_constrained: {
                        name: (
                            <FormattedMessage
                                id='admin.team_settings.team_row.managementMethod.groupSync'
                                defaultMessage='Group Sync'
                            />
                        ),
                        value: false,
                    },
                },
                keys: ['allow_open_invite', 'invite_only', 'group_constrained'],
            },
        };

        const filterProps = {
            options: filterOptions,
            keys: ['management'],
            onFilter: this.onFilter,
        };

        const rowsContainerStyles = {
            minHeight: `${rows.length * ROW_HEIGHT}px`,
        };

        return (
            <div className='TeamsList'>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={this.state.loading}
                    page={this.state.page}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    search={this.search}
                    term={term}
                    placeholderEmpty={placeholderEmpty}
                    rowsContainerStyles={rowsContainerStyles}
                    filterProps={filterProps}
                />
            </div>
        );
    }
}

