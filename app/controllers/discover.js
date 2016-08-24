import Ember from 'ember';
import config from 'ember-get-config';

var getProvidersPayload = '{"from": 0,"query": {"bool": {"must": {"query_string": {"query": "*"}}, "filter": [{"term": {"type.raw": "preprint"}}]}},"aggregations": {"sources": {"terms": {"field": "sources.raw","size": 200}}}}';

var filterMap = {
    providers: 'sources.raw',
    subjects: 'subjects.raw'
};

export default Ember.Controller.extend({
    // TODO: either remove or add functionality to info icon on "Refine your search panel"

    // Many pieces taken from: https://github.com/CenterForOpenScience/ember-share/blob/develop/app/controllers/discover.js
    queryParams: ['page', 'queryString', 'subjectFilter'],
    activeFilters: { providers: ['Open Science Framework', 'SocArxiv', 'Engrxiv'], subjects: [] },

    page: 1,
    size: 10,
    numberOfResults: 0,
    queryString: '',
    searchString: '',
    subjectFilter: null,
    queryBody: {},

    sortByOptions: ['Relevance', 'Upload date (oldest to newest)', 'Upload date (newest to oldest)'],

    treeSubjects: Ember.computed('activeFilters', function() {
        return this.get('activeFilters.subjects').slice();
    }),
    // chosenOption is always the first element in the list
    chosenSortByOption: Ember.computed('sortByOptions', function() {
        return this.get('sortByOptions')[0];
    }),

    showActiveFilters: true, //should always have a provider, don't want to mix osfProviders and non-osf
    showPrev: Ember.computed.gt('page', 1),
    showNext: Ember.computed('page', 'size', 'numberOfResults', function() {
        return this.get('page') * this.get('size') <= this.get('numberOfResults');
    }),

    results: Ember.ArrayProxy.create({ content: [] }),

    searchUrl: config.SHARE.searchUrl,

    init() {
        var _this = this;
        this._super(...arguments);
        this.set('facetFilters', Ember.Object.create());
        Ember.$.ajax({
            type: 'POST',
            url: this.get('searchUrl'),
            data: getProvidersPayload,
            contentType: 'application/json',
            crossDomain: true,
        }).then(function(results) {
            var hits = results.aggregations.sources.buckets;
            hits.map(function(each) {
                if (_this.get('osfProviders').indexOf(each.key) === -1) {
                    _this.get('otherProviders').pushObject(each.key);
                }
            });
        });
        this.loadPage.call(this);
    },
    subjectChanged: Ember.observer('subjectFilter', function() {
        let filter = this.get('subjectFilter');
        if (filter) {
            this.set('activeFilters.subjects', [filter]);
            this.notifyPropertyChange('activeFilters');
            this.loadPage.call(this);
        }
    }),
    queryStringPassed: Ember.observer('queryString', function() {
        let filter = this.get('queryString');
        if (filter) {
            this.set('searchString', filter);
            this.loadPage.call(this);
        }
    }),
    loadPage() {
        let queryBody = JSON.stringify(this.getQueryBody());
        this.set('loading', true);
        return Ember.$.ajax({
            url: this.get('searchUrl'),
            crossDomain: true,
            type: 'POST',
            contentType: 'application/json',
            data: queryBody
        }).then((json) => {
            if (this.isDestroyed || this.isDestroying) {
                return;
            }
            this.set('numberOfResults', json.hits.total);
            let results = json.hits.hits.map((hit) => {
                // HACK
                let source = hit._source;
                source.id = hit._id;
                source.type = 'elastic-search-result';
                source.workType = source['@type'];
                source.abstract = source.description;
                source.providers = source.sources;
                source.contributors = source.contributors.map(function(contributor) {
                    return {
                        users: {
                            familyName: contributor.family_name,
                            givenName: contributor.given_name,
                            id: contributor['@id']
                        }
                    };
                });
                return source;
            });
            this.set('loading', false);
            this.set('results', results);
        });
    },

    getQueryBody() {
        let facetFilters = this.get('activeFilters');
        let filters = {};
        for (let k of Object.keys(facetFilters)) {
            let key = filterMap[k];
            if (key && facetFilters[k].length) {
                filters[key] = facetFilters[k];
            }
        }
        let query = {
            query_string: {
                query: this.get('searchString') || '*'
            }
        };

        let filters_ = [];
        for (let k of Object.keys(filters)) {
            let terms = {};
            terms[k] = filters[k];
            filters_.push({
                terms: terms
            });
        }
        filters_.push({
            terms: {'type.raw': ['preprint']}
        });
        query = {
            bool: {
                must: query,
                filter: filters_
            }
        };

        let queryBody = {
            query,
            from: (this.get('page') - 1) * this.get('size'),
        };

        let sortByOption = this.get('chosenSortByOption');
        if (sortByOption === 'Upload date (oldest to newest)') {
            queryBody.sort = {};
            queryBody.sort.date_updated = 'asc';
        } else if (sortByOption === 'Upload date (newest to oldest)') {
            queryBody.sort = {};
            queryBody.sort.date_updated = 'desc';
        }

        return this.set('queryBody', queryBody);
    },

    expandedOSFProviders: false,
    reloadSearch: Ember.observer('activeFilters', function() {
        this.set('searchString', this.get('searchValue'));
        this.set('page', 1);
        this.loadPage();
    }),
    otherProviders: [],
    osfProviders: ['Open Science Framework', 'SocArxiv', 'Engrxiv'],
    actions: {
        search(val, event) {
            if (event && event.keyCode < 49 && !(event.keyCode === 8 || event.keyCode === 32)) {
                return;
            }
            this.set('searchString', this.get('searchValue'));
            this.set('page', 1);
            this.loadPage();
        },

        previous() {
            if (this.get('page') > 1) {
                this.decrementProperty('page');
                this.loadPage();
            }
        },

        next() {
            if (this.get('page') * this.get('size') <= this.get('numberOfResults')) {
                this.incrementProperty('page');
                this.loadPage();
            }
        },

        linkToAddPreprint() {
            this.transitionToRoute('submit');
        },

        clearFilters() {
            this.set('activeFilters',  { providers: this.get('osfProviders').slice(), subjects: [] });
        },

        sortBySelect(index) {
            // Selecting an option just swaps it with whichever option is first
            let copy = this.get('sortByOptions').slice(0);
            let temp = copy[0];
            copy[0] = copy[index];
            copy[index] = temp;
            this.set('sortByOptions', copy);
            this.set('page', 1);
            this.loadPage();
        },

        selectSubjectFilter(subject) {
            if (this.get('activeFilters.subjects').indexOf(subject.text) === -1) {
                this.get('activeFilters.subjects').pushObject(subject.text);
            } else {
                this.get('activeFilters.subjects').removeObject(subject.text);
            }
            this.notifyPropertyChange('activeFilters');
        },

        selectProvider(provider) {
            let currentProviders = this.get('activeFilters.providers').slice();
            if (provider === 'OSF Providers') {
                let match = currentProviders.filter(each => this.get('osfProviders').indexOf(each) !== -1);
                if (match.length) {
                    if (match.length < currentProviders.length) {
                        this.get('osfProviders').forEach(each => this.get('activeFilters.providers').removeObject(each));
                    } else {
                        return false;
                    }
                } else {
                    this.get('osfProviders').forEach(each => this.get('activeFilters.providers').pushObject(each));
                }
            } else {
                if (currentProviders.indexOf(provider) !== -1) {
                    if (currentProviders.length > 1) {
                        this.get('activeFilters.providers').removeObject(provider);
                    } else {
                        return false;
                    }
                } else {
                    this.get('activeFilters.providers').pushObject(provider);
                }
            }
            this.notifyPropertyChange('activeFilters');
        },
        expandOSFProviders() {
            this.set('expandedOSFProviders', !this.get('expandedOSFProviders'));
        }
    },
});
